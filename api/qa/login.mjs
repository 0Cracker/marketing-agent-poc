import {createQaGateway} from '../../backend/roas/qa-gateway.mjs';
export default async function handler(req,res){return createQaGateway().login(req,res);}
