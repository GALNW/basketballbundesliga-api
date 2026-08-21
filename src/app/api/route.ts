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
];

const allowedStatus = [
    'all',
    'past', 
    'future',
];

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

function getPreviousSeason(saison: string): string {
    const [year1, year2] = saison.split('-').map(Number);
    return `${year1 - 1}-${year2 - 1}`;
}

function filterAndSortGamesByStatus(data: any, status: string) {
    if (status === 'all' || typeof data !== 'object' || data === null) {
        return data;
    }

    const now = Math.floor(Date.now() / 1000);
    const filtered: Record<string, any[]> = {};

    for (const [day, games] of Object.entries(data)) {
        if (!Array.isArray(games)) continue;

        const dayGames = games.filter((game: any) => {
            if (!game.datetime) return true;
            const isPast = game.datetime < now;
            return status === 'past' ? isPast : !isPast;
        });

        dayGames.sort((a: any, b: any) => {
            return status === 'past'
                ? b.datetime - a.datetime
                : a.datetime - b.datetime;
        });

        if (dayGames.length > 0) {
            filtered[day] = dayGames;
        }
    }

    return filtered;
}

function hasGames(data: any): boolean {
    if (typeof data !== 'object' || data === null) return false;
    for (const games of Object.values(data)) {
        if (Array.isArray(games) && games.length > 0) return true;
    }
    return false;
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
    const status = url.searchParams.get('status') || 'all';

    if (!allowedTypes.includes(typ)) {
        return NextResponse.json(
            { error: 'Ungültiger Typ' },
            { status: 400, headers: getCorsHeaders(origin) },
        );
    }

    if (!allowedStatus.includes(status)) {
        return NextResponse.json(
            { error: 'Ungültiger Status. Erlaubte Werte: past, future' },
            { status: 400, headers: getCorsHeaders(origin) },
        );
    }

    let currentSaison = saison;
    let data: any = {};
    let attempts = 0;
    const maxAttempts = 10;

    try {
        while (attempts < maxAttempts) {
            attempts++;

            const apiUrl = typ === 'tabelle'
                ? `https://api.2basketballbundesliga.de/${typ}_${liga}/${apiKey}`
                : `https://api.2basketballbundesliga.de/${typ}/${liga}/${currentSaison}/${apiKey}`;

            const response = await fetch(apiUrl);

            if (!response.ok) {
                return NextResponse.json(
                    { error: 'Fehler beim Abruf der Liga-API' },
                    { status: 502, headers: getCorsHeaders(origin) },
                );
            }

            data = await response.json();

            if (typ === 'spielplan') {
                data = filterAndSortGamesByStatus(data, status);

                if (status === 'past' && !hasGames(data)) {
                    currentSaison = getPreviousSeason(currentSaison);
                    continue;
                }
            }

            break;
        }

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