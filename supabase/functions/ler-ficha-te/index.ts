import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const schema={type:'object',additionalProperties:false,required:['cabecalho','linhas','avisos'],properties:{
  cabecalho:{type:'object',additionalProperties:false,required:['propriedadeOPU','propriedadeTE','tecnica','dataTE','dataOPU','horaInicioTE','horaTerminoTE','tecnicoTE','anotacao','auxiliar'],properties:Object.fromEntries(['propriedadeOPU','propriedadeTE','tecnica','dataTE','dataOPU','horaInicioTE','horaTerminoTE','tecnicoTE','anotacao','auxiliar'].map(k=>[k,{type:'string'}]))},
  linhas:{type:'array',items:{type:'object',additionalProperties:false,required:['numero','doadora','racaDoadora','touro','racaTouro','racaEmbriao','qualidade','receptora','sequencia','cl','observacao','confianca','alerta'],properties:{numero:{type:'string'},doadora:{type:'string'},racaDoadora:{type:'string'},touro:{type:'string'},racaTouro:{type:'string'},racaEmbriao:{type:'string'},qualidade:{type:'string'},receptora:{type:'string'},sequencia:{type:'string'},cl:{type:'string'},observacao:{type:'string'},confianca:{type:'string',enum:['ok','revisar']},alerta:{type:'string'}}}},avisos:{type:'array',items:{type:'string'}}}}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  try{
    const key=Deno.env.get('OPENAI_API_KEY');if(!key)throw new Error('OPENAI_API_KEY não configurada no Supabase.')
    const {image}=await req.json();if(!image||typeof image!=='string')throw new Error('Imagem não recebida.')
    const prompt=`Leia esta ficha de TRANSFERÊNCIA DE EMBRIÕES bovinos da SÊMINNA. Extraia o cabeçalho e TODAS as linhas preenchidas da tabela.\nREGRAS CRÍTICAS:\n1) Aspas, dois traços, || ou marcas equivalentes nas colunas significam repetir o valor da linha anterior. Resolva a repetição e devolva o valor completo, não o símbolo.\n2) Preserve zeros à esquerda em identificações de receptoras (ex.: 003, 02, 040). Tudo deve ser string.\n3) Não adivinhe escrita ilegível. Campo duvidoso fica vazio ou com a leitura mais provável, confianca=revisar e explique em alerta.\n4) Rasuras, sobreposição, asteriscos e anotações incomuns exigem confianca=revisar.\n5) CL deve preservar exatamente códigos como OD1, OD2, OD3, OE1, OE2, OE3 e anotações como CAV.\n6) Qualidade/estágio do embrião deve preservar textos como BX G1, BI G1, BL GII etc.\n7) Ignore números manuscritos soltos acima da tabela que não pertencem a uma linha.\n8) dataTE e dataOPU em YYYY-MM-DD quando legíveis; caso contrário vazio.\n9) Retorne somente as linhas realmente preenchidas; não invente linhas ausentes.`
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:image}]}],text:{format:{type:'json_schema',name:'ficha_te',strict:true,schema}}})})
    const raw=await r.json();if(!r.ok)throw new Error(raw?.error?.message||'Falha na OpenAI.')
    const out=raw.output?.flatMap((x:any)=>x.content||[]).find((x:any)=>x.type==='output_text')?.text
    if(!out)throw new Error('A IA não retornou dados estruturados.')
    return new Response(out,{headers:{...cors,'Content-Type':'application/json'}})
  }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:400,headers:{...cors,'Content-Type':'application/json'}})}
})
