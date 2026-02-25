import type { MiddlewareObj, Request } from "@middy/core";
import { createError } from "@middy/util";
import type { StandardSchemaV1 as StandardSchema } from "@standard-schema/spec";

type RequestPart = "event" | "response";

export const standardSchemaValidator = <
  E extends StandardSchema,
  R extends StandardSchema,
>(
  {
    eventSchema,
    responseSchema,
    exposedErrors,
  }: {
    eventSchema?: E;
    responseSchema?: R;
    exposedErrors?: boolean;
  },
  eventHook?: (result: StandardSchema.Result<E>, request: Request) => any,
  responseHook?: (result: StandardSchema.Result<R>, request: Request) => any,
): MiddlewareObj<
  StandardSchema.InferOutput<E>,
  StandardSchema.InferInput<R>
> => {
  exposedErrors ??= false;
  const getValidator = buildValidator(exposedErrors);

  return {
    before: getValidator(eventSchema, "event", 400, eventHook),
    after: getValidator(responseSchema, "response", 500, responseHook),
  };
};

const buildValidator =
  (exposedErrors: boolean) =>
  <T extends StandardSchema>(
    schema: T | undefined,
    part: RequestPart,
    code: number,
    hook?: (result: StandardSchema.Result<any>, request: Request) => any,
  ) => {
    if (!schema) return undefined;
    return async (request: Request) => {
      let result = schema["~standard"].validate(request[part]);
      if (result instanceof Promise) result = await result;
      if (hook) {
        hook(result, request);
      }
      if (result.issues) {
        throw getValidationError(code, part, result, exposedErrors);
      }
      request[part] = result.value;
    };
  };

const getValidationError = (
  code: number,
  objectName: string,
  result: StandardSchema.FailureResult,
  exposedErrors: boolean,
) => {
  const message = exposedErrors
    ? result
    : `The ${objectName} object failed validation`;
  return createError(code, JSON.stringify({ message }), {
    cause: { package: "middy-standard-schema", data: result.issues },
  });
};
