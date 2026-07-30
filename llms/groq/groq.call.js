import Groq from 'groq-sdk';
import 'dotenv/config'
const groq = new Groq({ apiKey: process.env.GROQ_KEY });

export async function groqModelCall(model, message) {
    const interaction = await groq.chat.completions.create({
        messages: [
            {
                role : "user",
                content: message,
            },
        ],
        model : model,
    });
    if (!interaction) {
        return {status: "Failed", statusCode: 500, message : `Bad response from Groq model : ${model}`};
    }
    return {status: 'success',
        statusCode: 200, 
        response : interaction.choices[0].message.content, 
        total_tokens: interaction.usage.total_tokens, 
        input_tokens: interaction.usage.prompt_tokens,
        output_tokens: interaction.usage.completion_tokens,
        thought_tokens: interaction.usage.completion_tokens_details.reasoning_tokens,
        message : "Successful chat completion Groq",
    };
}