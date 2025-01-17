import { generateApolloClient } from "@deep-foundation/hasura/client.js";
import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { gql } from '@apollo/client/index.js';
import memoize from 'lodash/memoize.js';
import { createRequire } from 'node:module';


const require = createRequire(import.meta.url);
const memoEval = memoize(eval);

const bunEval = (code: string) => {
  const transpiler = new Bun.Transpiler();
  const codeWithEval = `eval((${code}))`
  const transpiledCode = transpiler.transformSync(codeWithEval);
  return eval(transpiledCode);
}


const GQL_URN = process.env.GQL_URN || '192.168.0.135:3006/gql';
const GQL_SSL = process.env.GQL_SSL || 0;

const requireWrapper = (id: string) => {
  return require(id);
}

DeepClient.resolveDependency = requireWrapper;

const toJSON = (data) => JSON.stringify(data, Object.getOwnPropertyNames(data), 2);

const makeFunction = (code: string) => {
  const fn = bunEval(code);
  if (typeof fn !== 'function')
  {
    throw new Error("Executed handler's code didn't return a function.");
  }
  return fn;
}

const makeDeepClient = (token: string) => {
  if (!token) throw new Error('No token provided');
  const decoded = parseJwt(token);
  const linkId = decoded?.userId;
  const apolloClient = generateApolloClient({
    path: GQL_URN,
    ssl: !!+GQL_SSL,
    token,
  });
  const deepClient = new DeepClient({ apolloClient, linkId, token }) as any;
  return deepClient;
}

console.log(`Listening ${process.env.PORT} port`);

const server = Bun.serve({
  port: process.env.PORT, // Specify the desired port
  async fetch(req, res) {
    const url = new URL(req.url);

    switch(url.pathname) { 
      case "/": { 
         return Response.json("{}"); 
      } 
      case "/healthz": { 
        return Response.json("{}"); 
      }
      case "/init": { 
        return Response.json("{}"); 
      }
      case "/call": { 
        try {
          const bodyJson = await req.json()
          console.log('call body params', bodyJson.params);
          const { jwt, code, data } = bodyJson.params || {};
          const fn = makeFunction(code);
          const deep = makeDeepClient(jwt);
          const result = await fn({ data, deep, gql, require: requireWrapper }); // Supports both sync and async functions the same way
          console.log('call result', result);
          return Response.json({ resolved: result });
        }
        catch(rejected)
        {
          const processedRejection = JSON.parse(toJSON(rejected));
          console.log('rejected', processedRejection);
          return Response.json({ rejected: processedRejection });
        }
      }
      case "/http-call": { 
        try {
          const options = decodeURI(`${req.headers['deep-call-options']}`) || '{}';
          console.log('deep-call-options', options);
          const { jwt, code, data } = JSON.parse(options as string);
          const fn = makeFunction(code);
          const deep = makeDeepClient(jwt);
          await fn(req, res, { data, deep, gql, require: requireWrapper }); // Supports both sync and async functions the same way
        }
        catch(rejected)
        {
          const processedRejection = JSON.parse(toJSON(rejected));
          console.log('rejected', processedRejection);
          return Response.json({ rejected: processedRejection });
        }
      }
      case "/stop-server": { 
        console.log('Stopping server...');
        process.exit(0);
        return new Response("{}"); 
      }
      default: { 
        return new Response("404!");
      } 
   }
  },
  error() {
		return new Response(null, { status: 404 });
	},
});