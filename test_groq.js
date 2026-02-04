// test_groq.js
const apiKey = process.env.GROQ_API_KEY || 'SUA_CHAVE_GSK_AQUI'; // O Cursor pode puxar do seu .env se já estiver lá

async function testGroq() {
    try {
        if (apiKey === 'SUA_CHAVE_GSK_AQUI') {
            console.log("⚠️  AVISO: Configure a variável de ambiente GROQ_API_KEY ou edite o arquivo para inserir sua chave.");
        }
        
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [{ role: "user", content: "Bilu Shape teste de conexão." }]
            })
        });
        
        const data = await response.json();
        
        if (response.status === 200) {
            console.log("Status da Groq: ✅ ATIVA");
            console.log("Resposta:", data.choices?.[0]?.message?.content || "Resposta vazia");
        } else {
            console.log("Status da Groq: ❌ ERRO");
            console.log("Status HTTP:", response.status);
            console.log("Resposta da API:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Erro ao conectar:", error.message);
        if (error.cause) {
            console.error("Detalhes:", error.cause);
        }
    }
}

testGroq();
