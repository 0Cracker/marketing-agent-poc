export class FlowError extends Error {
  constructor(code){super(code);this.code=code;}
}
export const requireThat=(condition,code)=>{if(!condition)throw new FlowError(code);};
