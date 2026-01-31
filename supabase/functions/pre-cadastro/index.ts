import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages } = await req.json()

    // 1. Cliente Admin (Chave Mestra) para GRAVAR no banco sem bloqueio
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // 2. Cliente Normal para identificar QUEM é o usuário
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Verifica quem está logado
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error("Erro de Auth:", userError)
      return new Response(JSON.stringify({ error: "Usuário não identificado" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const systemPrompt = {
      role: "system",
      content: `Você é o BiluTrainer. Entreviste o usuário para o perfil.
  DADOS: Peso(kg), Altura(cm), Idade, Biotipo, Objetivo, Dias/sem, Local(Casa/Academia), Lesões, Horários, Refeições/dia, Gênero.

  REGRAS:
  1. Pergunte 1 por vez.
  2. MAPEAMENTO DE OBJETIVO RIGOROSO (use exatamente estes textos no JSON):
     - "perder peso", "secar", "emagrecer" -> goal: "Perda de Peso"
     - "ficar forte", "ganhar massa", "crescer" -> goal: "Hipertrofia"
     - "saúde", "condicionamento" -> goal: "Condicionamento"
  3. DADOS NÃO INFORMADOS (chute consciente):
     - Horários: Se não falar, use padrão: wakeTime "07:00", workoutTime "18:00", sleepTime "22:00"
     - Refeições: Se não falar, use meals_per_day: 4
     - Gênero: Tente deduzir pelo nome ou adjetivos (ex: "cansada" = Feminino). Se não souber: "Não especificado"
  4. Ao final, retorne APENAS o JSON:
  {
    "FINALIZADO": true,
    "weight": 80,
    "height": 180,
    "age": 25,
    "biotype": "Mesomorfo",
    "goal": "Hipertrofia",
    "days_per_week": 5,
    "workout_location": "Academia",
    "injuries": ["joelho"],
    "wakeTime": "07:00",
    "workoutTime": "18:00",
    "sleepTime": "22:00",
    "meals_per_day": 4,
    "gender": "Masculino"
  }`
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get('BiluShapeIA')}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [systemPrompt, ...messages],
        temperature: 0.6
      })
    })

    const aiData = await response.json()
    const aiMessage = aiData.choices[0].message.content

    // SE A IA FINALIZOU, TENTA SALVAR
    if (aiMessage.includes('"FINALIZADO": true')) {
      const jsonMatch = aiMessage.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const profileData = JSON.parse(jsonMatch[0])

        console.log("Tentando salvar perfil para:", user.id)

        // Cálculo simplificado de TMB (Mifflin-St Jeor) para calorias
        const w = profileData.weight ?? 70
        const h = profileData.height ?? 170
        const a = profileData.age ?? 25
        const tmb = 10 * w + 6.25 * h - 5 * a + 5
        const activityFactor = (profileData.days_per_week ?? 3) >= 4 ? 1.375 : 1.2
        let calorias = Math.round(tmb * activityFactor)
        const goal = String(profileData.goal ?? '').toLowerCase()
        if (goal.includes('perda') || goal.includes('emagrec')) calorias = Math.max(1400, calorias - 500)
        else if (goal.includes('hipertrofia') || goal.includes('massa')) calorias = Math.min(3500, calorias + 300)
        calorias = Math.max(1200, Math.min(3500, calorias))

        // Grava usando o ADMIN (Service Role)
        const { error: saveError } = await supabaseAdmin.from('profiles').upsert({
          id: user.id,
          weight: profileData.weight,
          height: profileData.height,
          age: profileData.age,
          biotype: profileData.biotype,
          objective: profileData.goal, // Enviando o valor de goal para a coluna objective
          days_per_week: profileData.days_per_week,
          workout_location: profileData.workout_location,
          injuries: profileData.injuries,
          calories: calorias,
          updated_at: new Date().toISOString()
        })

        if (saveError) {
          console.error("ERRO CRÍTICO NO BANCO:", saveError)
          return new Response(JSON.stringify({
            role: 'assistant',
            content: "Tive um erro técnico ao salvar. Tente novamente."
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({
          role: 'assistant',
          content: "Perfil salvo com sucesso! Clique no botão abaixo para ver seu plano."
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify(aiData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
