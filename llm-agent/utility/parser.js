export function parseLLMResponse(raw) {
    if (!raw || typeof raw !== "string") {
        throw new Error("Invalid LLM response: not a string");
    }

    let cleaned = raw.trim();

    // 1. Remove markdown code fences
    cleaned = cleaned
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    // 2. Try direct parse
    try {
        return JSON.parse(cleaned);
    } catch (err) {
        // 3. fallback: try to extract JSON block
        const match = cleaned.match(/\{[\s\S]*\}/);

        if (!match) {
            throw new Error("No valid JSON found in LLM response");
        }

        try {
            return JSON.parse(match[0]);
        } catch (err2) {
            throw new Error("Failed to parse extracted JSON");
        }
    }
}