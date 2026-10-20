// Calls the pinned upstream checkers. No pitfall detection is implemented here.
import com.fasterxml.jackson.databind.ObjectMapper;
import es.upm.fi.oeg.oops.*;
import java.net.SocketPermission;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.Permission;
import java.util.*;
import org.apache.jena.ontology.*;
import org.apache.jena.rdf.model.*;

public final class OopsLocal {
    @SuppressWarnings("removal")
    private static final class OfflineGuard extends SecurityManager {
        int blocked = 0;
        @Override public void checkPermission(Permission permission) {
            if (permission instanceof SocketPermission ||
                permission instanceof RuntimePermission &&
                Set.of("setSecurityManager", "createSecurityManager").contains(permission.getName())) {
                blocked++;
                throw new SecurityException("OOPS offline policy: " + permission.getName());
            }
        }
        @Override public void checkConnect(String host, int port) {
            blocked++;
            throw new SecurityException("OOPS offline policy: connect denied");
        }
        @Override public void checkListen(int port) { throw new SecurityException("OOPS offline policy: listen denied"); }
        @Override public void checkAccept(String host, int port) { throw new SecurityException("OOPS offline policy: accept denied"); }
    }

    @SuppressWarnings("removal")
    public static void main(String[] args) throws Exception {
        OfflineGuard guard = new OfflineGuard();
        System.setSecurityManager(guard);
        // Exercise the restriction before any model is read. No connection is opened.
        try { new java.net.Socket("127.0.0.1", 9); throw new IllegalStateException("network policy inactive"); }
        catch (SecurityException expected) { }
        guard.blocked = 0;
        Map<String,Object> output = new LinkedHashMap<>();
        List<Map<String,Object>> rules = new ArrayList<>(), findings = new ArrayList<>();
        String content = Files.readString(Path.of(args[0]), StandardCharsets.UTF_8);
        SrcSpec source = new SrcSpec(SrcType.RDF_CODE, null, content, null);
        OntDocumentManager documents = new OntDocumentManager();
        documents.setProcessImports(false);
        OntModelSpec spec = new OntModelSpec(OntModelSpec.OWL_MEM);
        spec.setDocumentManager(documents);
        OntModel jena = ModelFactory.createOntologyModel(spec);
        jena.read(new java.io.StringReader(content), null, "RDF/XML");
        if (jena.contains(null, org.apache.jena.vocabulary.OWL.imports))
            throw new IllegalArgumentException("Remote imports require an explicitly resolved local definition graph");
        SrcModel model = new SrcModel(source, jena, ModelLoader.loadOwl(source));
        List<Checker> checkers = CheckersCatalogue.getAllCheckers();
        checkers.sort(Comparator.comparingInt(c -> c.getInfo().getId().getNumeral()));
        Set<Integer> ids = new HashSet<>();
        for (Checker checker : checkers) {
            int number = checker.getInfo().getId().getNumeral();
            if (!ids.add(number)) throw new IllegalStateException("Duplicate checker " + number);
            String id = String.format("P%02d", number);
            Map<String,Object> rule = new LinkedHashMap<>();
            rule.put("code", id); rule.put("title", checker.getInfo().getTitle());
            if (number >= 36 && number <= 41) {
                rule.put("status", "not_applicable");
                rule.put("reason", number == 41 ?
                    "Upstream P41 sends ontology content to Licensius; excluded from offline execution. Local license metadata is reported separately." :
                    "Published ontology URL is required; this scope is a local unpublished definition graph.");
                rules.add(rule); continue;
            }
            try {
                CheckingContext context = new CheckingContext(model, ModelFactory.createDefaultModel());
                checker.check(context);
                rule.put("status", "pass");
                List<String> warnings = new ArrayList<>();
                for (Warning warning : context.getWarnings()) warnings.add(warning.toString());
                rule.put("warnings", warnings);
                for (var entry : context.getResults().entrySet()) {
                    for (Pitfall pitfall : entry.getValue()) {
                        Map<String,Object> finding = new LinkedHashMap<>();
                        finding.put("code", pitfall.getInfo().getId().toString());
                        finding.put("title", pitfall.getInfo().getTitle());
                        finding.put("importance", pitfall.getInfo().getImportance().toString());
                        finding.put("resources", pitfall.getResources().stream().map(r -> r.isURIResource() ? r.getURI() : r.toString()).sorted().toList());
                        finding.put("description", pitfall.getInfo().getExplanation());
                        findings.add(finding);
                    }
                }
            } catch (Exception exception) {
                rule.put("status", "not_run");
                rule.put("reason", exception.getClass().getName() + ": " + exception.getMessage());
            }
            rules.add(rule);
        }
        findings.sort(Comparator.comparing(x -> x.get("code") + ":" + x.get("resources")));
        output.put("rules", rules); output.put("findings", findings);
        output.put("catalogue_size", checkers.size());
        output.put("unimplemented_rules", CheckersCatalogue.getCheckerInfosUnimplemented().stream().map(c -> c.getId().toString()).sorted().toList());
        output.put("network_policy", "deny all socket access; remote imports disabled");
        output.put("blocked_network_attempts", guard.blocked);
        output.put("network_policy_self_check", "pass");
        output.put("scan_executed", rules.stream().noneMatch(x -> x.get("status").equals("not_run")) && guard.blocked == 0);
        new ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(Path.of(args[1]).toFile(), output);
    }
}
