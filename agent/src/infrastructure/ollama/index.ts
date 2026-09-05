import type { OllamaChatChunk, OllamaClient, OllamaUsage } from '../../interfaces/ollama/ollama-client.js';
export function createOllamaClient(baseUrl: string): OllamaClient {
  return {
    async health() { try { return (await fetch(`${baseUrl}/api/tags`)).ok; } catch { return false; } },
    async listModels() { const r=await fetch(`${baseUrl}/api/tags`); if(!r.ok) throw new Error('ollama unavailable'); const b=await r.json() as {models?:Array<{name:string}>}; return (b.models??[]).map(m=>m.name); },
    async pullModel(model) { const r=await fetch(`${baseUrl}/api/pull`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:model,stream:false})}); if(!r.ok) throw new Error('model pull failed'); },
    async *chat(model,payload,signal) { const r=await fetch(`${baseUrl}/api/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,...(payload as object),stream:true}),signal}); if(!r.ok||!r.body) throw new Error('ollama chat failed'); const reader=r.body.getReader(); const decoder=new TextDecoder(); let buf=''; while(true){const {done,value}=await reader.read();if(done)break;buf+=decoder.decode(value,{stream:true});const lines=buf.split('\n');buf=lines.pop()??'';for(const line of lines){try{const item=JSON.parse(line) as {message?:{content?:string};prompt_eval_count?:number;eval_count?:number;done?:boolean};const chunk: OllamaChatChunk = {}; if(item.message?.content) chunk.content=item.message.content; if(item.done){const usage: OllamaUsage = {prompt_tokens:item.prompt_eval_count??0,completion_tokens:item.eval_count??0,total_tokens:(item.prompt_eval_count??0)+(item.eval_count??0)}; chunk.usage=usage;} if(chunk.content || chunk.usage) yield chunk;}catch { continue; }}} },
  };
}
