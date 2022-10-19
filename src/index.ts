/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
    TWITCH_AUTH: string;
    TWITCH_CLIENT_ID: string;
    // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
    // MY_KV_NAMESPACE: KVNamespace;
    //
    // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
    // MY_DURABLE_OBJECT: DurableObjectNamespace;
    //
    // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
    // MY_BUCKET: R2Bucket;
}

type Fetch = {
    pathReg: RegExp;
    methods: string[];
    handlers: ((request: RequestData) => Response | Promise<Response>)[];
};

type Obj = {
    [propName: string]: string
}

interface RequestData {
    request: Request
    env: Env
    method: string
    params?: Obj
    query?: Obj
    url: string
}

const targets: Fetch[] = [];
const targetPaths: RegExp[] = [];

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        let response, match, url = new URL(request.url), requestData: RequestData = {request: request, env: env, method: request.method, url: request.url};
        requestData.query = Object.fromEntries(url.searchParams)
        for (const {pathReg, methods, handlers} of targets) {
            if ((methods.includes(request.method.toUpperCase()) || methods.includes('ALL')) && (match = url.pathname.match(pathReg))) {
                requestData.params = match.groups
                for (const handler of handlers) {
                    if ((response = await handler(requestData)) !== undefined) return response;
                }
            }
        }
        return new Response(`Invalid ${request.method.toUpperCase()} request!`, {status: 404});
    }
};

function CUSTOM(path: string, ...methods: string[]) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        info(`Adding handler for path "${path.toString()}" for methods ${JSON.stringify(methods)}`)

        //Code from itty-router
        const regex = RegExp(`^${('' + path)
                .replace(/(\/?)\*/g, '($1.*)?')                             // trailing wildcard
                .replace(/(\/$)|((?<=\/)\/)/, '')                           // remove trailing slash or double slash from joins
                .replace(/:(\w+)(\?)?(\.)?/g, '$2(?<$1>[^/]+)$2$3')         // named params
                .replace(/\.(?=[\w(])/, '\\.')                              // dot in path
                .replace(/\)\.\?\(([^\[]+)\[\^/g, '?)\\.?($1(?<=\\.)[^\\.') // optional image format
            }/*$`);

        if (targetPaths.includes(regex)) {
            const t = targets.find(value => value.pathReg === regex);
            if (t == undefined) {
                error("Target path cache doesn't match target list! Possible unauthorized modification of the API!")
                return;
            }

            if (!t.handlers.includes(descriptor.value)) {
                t.handlers.push(descriptor.value);
            }

            for (const method of methods) {
                if (t.methods.includes(method.toUpperCase())) {
                    error(`Target path "${path.toString()}" already has method "${method.toString().toUpperCase()}" handled! Skipping!`)
                    continue;
                } else {
                    t.methods.push(method);
                }
            }
        }

        targetPaths.push(regex);
        targets.push({pathReg: regex, methods: methods, handlers: [descriptor.value]})
    }
}

function GET(path: string) {
    return CUSTOM(path, "GET");
}

function HEAD(path: string) {
    return CUSTOM(path, "HEAD");
}

function POST(path: string) {
    return CUSTOM(path, "POST");
}

function PUT(path: string) {
    return CUSTOM(path, "PUT");
}

function DELETE(path: string) {
    return CUSTOM(path, "DELETE");
}

function CONNECT(path: string) {
    return CUSTOM(path, "CONNECT");
}

function OPTIONS(path: string) {
    return CUSTOM(path, "OPTIONS");
}

function TRACE(path: string) {
    return CUSTOM(path, "TRACE");
}

function PATCH(path: string) {
    return CUSTOM(path, "PATCH");
}

function ALL(path: string) {
    return CUSTOM(path, "ALL");
}

function debug(data: any) {
    console.info("FTM API [DEBUG]: ", data);
}

function info(data: any) {
    console.info("FTM API [INFO]: ", data);
}

function warn(data: any) {
    console.warn("FTM API [WARN]: ", data);
}

function error(data: any) {
    console.info("FTM API [ERROR]: ", data);
}

class API {
    @GET("/v1/*?")
    removed(request: RequestData): Response {
        return new Response("The API v1 has been deprecated and removed!")
    }

    @GET("/v2/helloworld")
    helloWorld(request: RequestData): Response {
        return new Response("Hello world!");
    }

    @GET("/v2/twitch/users/:user")
    async users(request: RequestData): Promise<Response | undefined> {
        const headers = {
            headers: {
                'Authorization': `Bearer ${request.env.TWITCH_AUTH}`,
                'Client-Id': `${request.env.TWITCH_CLIENT_ID}`
            }
        }
        const user = request.params.user;
        const userValidate = RegExp("^[a-zA-Z\\d]\\w{0,24}$");
        let search = "";

        if (!request.query.type) {
            if (parseInt(user)) search = `?id=${user}`;
            else if (user.match(userValidate)) search = `?login=${user}`;
            else return undefined; //TODO: change that
        } else {
            if (request.query.type === "login" || request.query.type === "user" && user.match(userValidate)) search = `?login=${user}`;
            else if (request.query.type === "id") search = `?id=${user}`;
            else return undefined; //TODO: change that
        }
        const url = `https://api.twitch.tv/helix/users${search}`
        return fetch(url, headers);
    }
}