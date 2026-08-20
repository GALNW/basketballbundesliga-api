import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const allowedOrigins = [
    'https://giessen-46ers.webflow.io',
    'https://giessen-46ers.canvas.webflow.com',
    'https://giessen46ers.de',
    'https://www.giessen46ers.de',
];

const allowedTypes = [
    'spielplan',
    'tabelle',
]

function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function GET(request: Request) {
    const origin = request.headers.get('origin');
    const { env } = getCloudflareContext();
    const apiKey = env.LIGA_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: 'Server configuration error' },
            { status: 500 },
        );
    }

    const url = new URL(request.url);
    const liga = url.searchParams.get('liga') || 'proa';
    const saison = url.searchParams.get('saison') || '2017-2018';
    const typ = url.searchParams.get('typ') || 'spielplan';

    if (!allowedTypes.includes(typ)) {
        return NextResponse.json(
            { error: 'Ungültiger Typ. Erlaubt: spielplan, tabelle' },
            { status: 400, headers: getCorsHeaders(origin) },
        );
    }

    const apiUrl = typ === 'tabelle'
        ? `https://api.2basketballbundesliga.de/${typ}_${liga}/${apiKey}`
        : `https://api.2basketballbundesliga.de/${typ}/${liga}/${saison}/${apiKey}`;

    try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
            return NextResponse.json(
                { error: `Fehler beim Abruf der Liga-API, ${apiUrl}` },
                { status: 502, headers: getCorsHeaders(origin) },
            );
        }

        const data = await response.json();

        return NextResponse.json(data, {
            headers: {
                ...getCorsHeaders(origin),
                'Cache-Control': 'public, max-age=3600',
            }
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Interner Serverfehler' },
            { status: 500, headers: getCorsHeaders(origin) },
        );
    }
}
