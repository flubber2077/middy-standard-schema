# Middy-Standard-Schema

[![CI](https://github.com/flubber2077/middy-standard-schema/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/flubber2077/middy-standard-schema/actions/workflows/ci.yml)[![Module type: CJS+ESM](https://img.shields.io/badge/module%20type-cjs%2Besm-brightgreen)](https://github.com/voxpelli/badges-cjs-esm)[![package size](https://badgen.net/bundlephobia/minzip/middy-standard-schema)](https://bundlephobia.com/result?p=middy-standard-schema)

A Standard-Schema based Middy Validator

## Getting started

### Install

```bash
npm install middy-standard-schema
```

### Usage

After installation, use as a standard middy middleware with any compatible schema.

```typescript
import middy from "@middy/core";
import httpErrorHandler from "@middy/http-error-handler";
import z from "zod";

export const eventSchema = z.object({
  body: z.object({
    HelloWorld: z.string(),
  }),
});

export const handler = middy()
  .use(httpErrorHandler())
  .use(standardSchemaValidator({ eventSchema }))
  .handler(lambdaFunction);
```

## Features

### Supports any Standard-Schema compatible validation library

Whether it's Zod, Arktype, Valibot, Joi, Yup, or [any other compatible library](https://standardschema.dev/#what-schema-libraries-implement-the-spec), middy-standard-schema works without any further configuration.

```typescript
import z from "zod";
import { type } from "arktype";
import * as v from "valibot";

middy()
  .use(standardSchemaValidator({ eventSchema: z.object() }))
  .use(standardSchemaValidator({ eventSchema: type({}) }))
  .use(standardSchemaValidator({ eventSchema: v.object({}) }))
  .handler(lamdaFunction);
```

### Intelligently merges into Event type

```typescript
const eventSchema = z.looseObject({
  queryStringParameters: z.looseObject({ search: z.string() }),
});

middy<APIGatewayProxyEvent>()
  .use(standardSchemaValidator({ eventSchema }))
  .handler((event) => {
    event.queryStringParameters.search;
    //                          ^? (property) search: string
    event.queryStringParameters.unspecified;
    //                          ^? string | undefined
  });
```

### Transform Requests on Command

By default, events will be transformed by the validation. This behavior can be modified to also transform Contexts and Responses, or turned off altogether to just allow for non-transforming validation.

### Error Handling

Middy Standard Schema has built in error handling, returning information to the client is opt-in with `exposedErrors` the option.

```typescript
import z from "zod";
import * as v from "valibot";

middy()
  .use(
    standardSchemaValidator({
      eventSchema: z.object(),
    }),
  )
	// ^ throws a generic "The Event object failed validation" 400 error
  .use(
    standardSchemaValidator({
      eventSchema: v.object({}),
      exposeErrors: true,
    }))
		// ^ throws a 400 error with StandardSchema FailureResults object
	.use(
    standardSchemaValidator({
      eventSchema: v.object({}),
    }, (result, request) => {
			if(result.issues){
				throw new Error('lorem ipsum');
			}
			console.log(request.context);
		}),
		// ^ include the logging you need, or throw a specific error
  )
  .handler(lambdaFunction);
```

## Contribution

Any and all issues and PRs are **greatly** appreciated.
Please leave a star if this project was helpful to you.
