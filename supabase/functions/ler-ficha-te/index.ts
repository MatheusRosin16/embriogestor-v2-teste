import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const key = Deno.env.get('GOOGLE_VISION_API_KEY')

    if (!key) {
      throw new Error(
        'GOOGLE_VISION_API_KEY não configurada no Supabase.'
      )
    }

    const body = await req.json()
    const image = body?.image

    if (!image || typeof image !== 'string') {
      throw new Error('Imagem não recebida.')
    }

    // O frontend envia a foto como Data URL:
    // data:image/jpeg;base64,AAAA...
    // O Google Vision precisa somente da parte Base64.
    const base64 = image.includes(',')
      ? image.split(',')[1]
      : image

    if (!base64) {
      throw new Error(
        'Não foi possível extrair os dados da imagem.'
      )
    }

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64,
              },

              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                },
              ],
            },
          ],
        }),
      }
    )

    const raw = await response.json()

    if (!response.ok) {
      const mensagem =
        raw?.error?.message ||
        'Falha ao processar a ficha com Google Cloud Vision.'

      throw new Error(mensagem)
    }

    const resultado = raw?.responses?.[0]

    if (resultado?.error) {
      throw new Error(
        resultado.error.message ||
        'O Google Vision retornou um erro.'
      )
    }

    const texto =
      resultado?.fullTextAnnotation?.text || ''

    if (!texto.trim()) {
      throw new Error(
        'O Google Vision não conseguiu identificar texto na ficha.'
      )
    }

    /*
     * PRIMEIRO TESTE DO GOOGLE VISION
     *
     * Ainda não vamos criar transferências.
     * Vamos verificar exatamente o que o OCR consegue
     * ler da ficha manuscrita real.
     */
    return new Response(
      JSON.stringify({
        cabecalho: {
          propriedadeOPU: '',
          propriedadeTE: '',
          tecnica: '',
          dataTE: '',
          dataOPU: '',
          horaInicioTE: '',
          horaTerminoTE: '',
          tecnicoTE: '',
          anotacao: '',
          auxiliar: '',
        },

        linhas: [],

        avisos: [
          'TESTE GOOGLE VISION — OCR realizado com sucesso.',
          texto,
        ],
      }),
      {
        headers: {
          ...cors,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({
        error:
          e instanceof Error
            ? e.message
            : String(e),
      }),
      {
        status: 400,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})