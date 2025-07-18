import type {
  CallbackObject,
  FailedParams,
  RequestHook,
  RequestHookKey,
  RequestHooks,
  RequestMethod,
  RequestReturn
} from "./def";
import { addQuery, parse, transformPathParams } from "./lib";

import type { FastjsRequest } from "./fetch-types";
import _dev from "../dev";
import { globalConfig } from "./config";

export function sendRequest(
  request: FastjsRequest,
  method: RequestMethod,
  url: string = request.url
): FastjsRequest {
  if (__DEV__) {
    if (["GET", "HEAD", "OPTIONS"].includes(method) && request.config.body) {
      _dev.warn(
        "fastjs/request",
        `Body is not allowed in ${method} request, use POST instead. (HTTP 1.1)`,
        [
          `url: ${url}`,
          `*method: ${method}`,
          `*body: `,
          request.body,
          "super: ",
          request
        ],
        ["fastjs.warn"]
      );
    }
  }

  const data = {
    body: isBodyAllowed(method) ? request.data : null,
    query: (isBodyAllowed(method) ? null : request.data) || request.config.query
  };

  if (request.config.wait) {
    if (request.wait) clearTimeout(request.wait);
    request.wait = setTimeout(() => {
      passthrough();
      request.wait = null;
    }, request.config.wait);
  } else passthrough();

  return request;

  function isBodyAllowed(method: RequestMethod): boolean {
    return !["GET", "HEAD", "OPTIONS"].includes(method);
  }

  async function passthrough() {
    const hooks = request.config.hooks;
    if (!runHooks(hooks.before, [request]))
      return hookFailed("before", request, null);

    let pathParamMatches: string[] = [];
    [url, pathParamMatches] = transformPathParams(url, request.data);
    for (const match of pathParamMatches) {
      delete request.data[match];
    }

    request.request = new Request(addQuery(url, data.query), {
      method,
      headers: request.config.headers,
      body: data.body ? JSON.stringify(data.body) : undefined
    });

    if (!runHooks(hooks.init, [request]))
      return hookFailed("init", request, null);

    fetch(request.request)
      .then(async (response: Response) => {
        const data = await globalConfig.handler.handleResponse(
          response,
          request
        );

        const requestReturn: RequestReturn = {
          headers: [...response.headers.entries()],
          headersObj: Object.fromEntries(response.headers.entries()),
          response,
          data: parse(data),
          status: response.status,
          request,
          resend: () => sendRequest(request, method)
        };

        if (!globalConfig.handler.responseCode(response.status, request))
          return handleBadResponse(requestReturn, request, passthrough);

        if (!runHooks(hooks.success, [requestReturn, request]))
          return hookFailed("success", request, requestReturn);

        matchCallback(request.callback.success, [data, requestReturn], method);
        matchCallback(request.callback.finally, [request], method);
      })
      .catch((error: Error) => {
        if (__DEV__)
          _dev.warn(
            "fastjs/request",
            "Failed to send request.",
            [
              `url: ${url}`,
              `method: ${method}`,
              `body: `,
              request.body,
              `error: ${error.message}`,
              "super: ",
              request
            ],
            ["fastjs.wrong"]
          );

        if (!runHooks(hooks.failed, [error, request]))
          return hookFailed("failed", request, null);

        const failedParams = {
          error,
          request,
          intercept: false,
          hook: null,
          response: null
        };

        request.config.failed(failedParams);
        matchCallback(request.callback.failed, [failedParams], method);
        matchCallback(request.callback.finally, [request], method);
      });
  }
}

function matchCallback(
  callback: CallbackObject<any>[],
  params: any[],
  method: RequestMethod | null
): void {
  for (let i = 0; i < callback.length; i++) {
    const call = callback[i];
    if (call.method && call.method !== method) continue;
    call.func(...params);
    if (call.once) callback.splice(i, 1), i--;
  }
}

function handleBadResponse(
  response: RequestReturn,
  request: FastjsRequest,
  resend: Function
) {
  let status = response?.status;
  let res = response.data;
  if (__DEV__) {
    _dev.warn(
      "fastjs/request",
      `Request failed with status code ${status}`,
      [
        `url: ${request.request?.url}`,
        `method: ${request.request?.method}`,
        `*code: ${status}`,
        `*response: `,
        res,
        "super: ",
        request
      ],
      ["fastjs.wrong"]
    );
  }

  if (!runHooks(request.config.hooks.failed, [status, request]))
    return hookFailed("failed", request, null);

  const failedParams: FailedParams<number> = {
    error: status,
    request,
    intercept: false,
    hook: null,
    response
  };

  request.config.failed(failedParams);
  matchCallback(request.callback.failed, [failedParams], null);
  matchCallback(request.callback.finally, [request], null);
}

function hookFailed(
  hook: RequestHookKey,
  request: FastjsRequest,
  response: RequestReturn | null
) {
  const failedParams: FailedParams<Error> = {
    error: new Error(`Request interrupted by ${hook}`),
    request,
    intercept: true,
    hook,
    response
  };
  request.config.failed(failedParams);
  matchCallback(request.callback.failed, [failedParams], null);
  matchCallback(request.callback.finally, [request], null);
}

function runHooks<T extends RequestHook[] | RequestHook | undefined>(
  hooks: T,
  params: T extends RequestHooks.BeforeSend
    ? [FastjsRequest]
    : [RequestReturn | Error | number, FastjsRequest]
): boolean {
  type FirstParam = ((number & FastjsRequest) | (Error & FastjsRequest)) &
    RequestReturn;
  if (!hooks) return true;
  if (typeof hooks === "function")
    return hooks(params[0] as FirstParam, params[1] as FastjsRequest);
  let result = true;
  for (const hook of hooks as RequestHook[]) {
    if (!hook(params[0] as FirstParam, params[1] as FastjsRequest)) {
      result = false;
      if (!globalConfig.hooks.runAll) break;
    }
  }
  return result;
}
