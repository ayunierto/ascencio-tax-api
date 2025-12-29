import {
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { parseZodIssueMessage } from '@ascencio/shared';

export interface ValidationError {
  field?: string;
  messageKey: string;
  params?: Record<string, string | number>;
}

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (!(error instanceof ZodError)) {
        throw new BadRequestException(error);
      }

      const errors: ValidationError[] = error.issues.map((issue) => {
        const parsed = parseZodIssueMessage(issue.message);

        return {
          field: issue.path.join('.') || undefined,
          messageKey: parsed.messageKey,
          params: parsed.params,
        };
      });

      throw new BadRequestException({
        errors,
      });
    }
  }
}
