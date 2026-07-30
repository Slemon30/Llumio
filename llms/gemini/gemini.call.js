import { GoogleGenAI } from '@google/genai';
import 'dotenv/config'
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });

export async function geminiModelCall(model, message, interactionId = null) {
        const interaction = await ai.interactions.create({
            model: model,
            input: message,
            ...(interactionId && {previous_interaction_id: interactionId}),
        });
        if (!interaction) {
            return {status: "Failed", statusCode: 500, message : `Bad response from Gemini model : ${model}`};
        }

        return {status: 'success', 
            statusCode: 200,
            interactionId : interaction.id,
            response : interaction.output_text, 
            total_tokens: interaction.usage.total_tokens, 
            input_tokens: interaction.usage.total_input_tokens,
            output_tokens: interaction.usage.total_output_tokens,
            thought_tokens: interaction.usage.total_thought_tokens,
            message : "Successful chat completion Gemini",
        };
}