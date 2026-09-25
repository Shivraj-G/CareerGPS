/**
 * Shared Zod validation middleware.
 * The parsed value is written back to req.body so downstream handlers
 * only receive validated/coerced data.
 */
export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request contains invalid fields.',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        }
      });
    }

    req.body = parsed.data;
    return next();
  };
}
