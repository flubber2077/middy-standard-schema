import type { Request } from "@middy/core";
import middy from "@middy/core";
import httpErrorHandler from "@middy/http-error-handler";
import { HttpError } from "@middy/util";
import type { StandardSchemaV1 as StandardSchema } from "@standard-schema/spec";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { describe, expect, expectTypeOf, test } from "vitest";
import z from "zod";
import { standardSchemaValidator } from "./index.js";

describe("basic tests", () => {
  test("expect empty middleware if nothing is supplied", () => {
    const middleware = standardSchemaValidator({});
    expect(middleware.before).toBeUndefined();
    expect(middleware.after).toBeUndefined();
    expect(middleware.onError).toBeUndefined();
  });

  test("expect middleware to be populated if schemes are supplied", () => {
    const mockSchema = z.object();
    const middleware = standardSchemaValidator({
      eventSchema: mockSchema,
      responseSchema: mockSchema,
    });
    expect(middleware.before).not.toBeUndefined();
    expect(middleware.after).not.toBeUndefined();
    expect(middleware.onError).toBeUndefined();
  });
});

describe("validation failure test suite", () => {
  const sch = z.object({});
  test.each([
    ["event", "before", 400],
    ["response", "after", 500],
  ] as const)(
    "if validation fails in %s, proper error is thrown",
    async (part, method, statusCode) => {
      const schema = z.object({});
      const middleware = standardSchemaValidator({ [`${part}Schema`]: schema });
      const request = { [part]: "notAnObject" };
      await expect(
        middleware[method]!(request as unknown as Request),
      ).rejects.toThrowError(HttpError);
      await expect(
        middleware[method]!(request as unknown as Request),
      ).rejects.toMatchObject({
        statusCode,
        cause: { package: "middy-standard-schema", data: {} },
      });
    },
  );
});

describe("modify objects test suite", () => {
  const modifyingSchema = z.object({}).transform(() => "exists");
  const middleware = standardSchemaValidator({
    eventSchema: modifyingSchema,
    responseSchema: modifyingSchema,
  });
  const request = {
    event: {},
    context: {},
    response: {},
    error: undefined,
    internal: undefined,
  };

  test("test modify of before", async () => {
    await middleware.before!(request as unknown as Request);
    expect(request).toMatchObject({
      event: "exists",
      response: {},
    });
  });

  test("test modify of before", async () => {
    await middleware.after!(request as unknown as Request);
    expect(request).toMatchObject({
      event: {},
      response: "exists",
    });
  });
});

describe("asynchronous tests", () => {
  test("basic asynchronous test", async () => {
    const schema = z.object().transform(async () => await "hi");

    const middleware = standardSchemaValidator({
      eventSchema: schema,
      responseSchema: schema,
    });
    const request = { event: {}, context: {}, response: {} };
    await middleware.before!(request as Request);
    await middleware.after!(request as Request);
    expect(request.event).toBe("hi");
    expect(request.response).toBe("hi");
  });
});

describe("error handling tests", () => {
  test("failed validation throws http error with cause", async () => {
    const func = middy().use(
      standardSchemaValidator({ eventSchema: z.string() }),
    );

    await expect(
      func(1234 as unknown as string, {} as Request["context"]),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: JSON.stringify({
        message: "The event object failed validation",
      }),
    });
  });

  describe("error conversion checks", () => {
    test("error is properly returned", async () => {
      const thing = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
        .use(httpErrorHandler({ logger: false }))
        .use(standardSchemaValidator({ eventSchema: z.strictObject({}) }));
      await expect(
        thing(
          { hi: "hi" } as unknown as Record<string, never> &
            APIGatewayProxyEvent,
          {} as Request["context"],
        ),
      ).resolves.toMatchObject({
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "The event object failed validation" }),
      });
    });
  });
});

// Middy does not propagate the modified context or response to the handler
describe("typing tests", () => {
  describe("event typing tests", () => {
    test("headers are able to be specified", () => {
      const eventSchema = z.looseObject({
        headers: z.looseObject({ search: z.string() }),
      });

      middy<APIGatewayProxyEvent>()
        .use(standardSchemaValidator({ eventSchema }))
        .handler((event) => {
          expectTypeOf(event.headers.search).toEqualTypeOf<string>();
          expectTypeOf(event.headers.other).toEqualTypeOf<string | undefined>();
        });
    });

    test("able to override body", () => {
      const eventSchema = z.looseObject({
        body: z.object({ thing: z.string({}) }),
      });

      middy<APIGatewayProxyEvent>()
        .use(standardSchemaValidator({ eventSchema }))
        .handler((event) => {
          expectTypeOf(event).not.toEqualTypeOf<APIGatewayProxyEvent>();
          expectTypeOf(event).toExtend<APIGatewayProxyEvent>();
          expectTypeOf(event.body.thing).toEqualTypeOf<string>();
        });
    });

    test("normal passthrough of event type if event is not supplied", () => {
      const responseSchema = z.object();
      middy<APIGatewayProxyEvent>()
        .use(standardSchemaValidator({ responseSchema }))
        .handler((event) => {
          expectTypeOf(event).toEqualTypeOf<APIGatewayProxyEvent>();
          expectTypeOf(event.body).toExtend<string | null>();
        });
    });
  });
});
