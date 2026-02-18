import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { CategoriesService } from 'src/accounting/categories/categories.service';

@Injectable()
export class OpenaiService {
  private openai: OpenAI;

  constructor(private readonly categoriesService: CategoriesService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    this.openai = new OpenAI({
      apiKey,
    });
  }

  /**
   * Analyzes receipt text using OpenAI's GPT model to extract structured data.
   *
   * @param text The receipt text to analyze.
   * @returns A JSON object containing the extracted merchant, tax, date, total, category, and subcategory.
   */
  async analyzeReceiptText(text: string) {
    const categories = await this.categoriesService.findAll();

    const prompt = `
Extract this data from the receipt text:
- merchant (string)
- date (ISO 8601 datetime format: YYYY-MM-DDTHH:mm:ss.sssZ, use T00:00:00.000Z if only date is known)
- total (number, not string)
- tax (number, not string)
- categoryId (the id of the best matching category as string)
- subcategoryId (the id of the best matching subcategory as string)

Categories:
${JSON.stringify(categories, null, 2)}

IMPORTANT: 
- total and tax must be numbers, not strings
- date must be in ISO 8601 datetime format with timezone (e.g., "2024-01-15T00:00:00.000Z")
- If any field is unknown, use: "" for strings, 0 for numbers

Return ONLY valid JSON like:
{"merchant":"Store Name","date":"2024-01-15T00:00:00.000Z","total":100.50,"tax":8.25,"categoryId":"uuid-here","subcategoryId":"uuid-here"}

Receipt text:
"""${text}"""
`;

    const res = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You extract structured data from receipt text.',
        },
        { role: 'user', content: prompt },
      ],
    });
    const content = res.choices[0].message.content;
    if (!content) {
      throw new Error('OpenAI response content is empty');
    }

    return JSON.parse(content);
  }
}
