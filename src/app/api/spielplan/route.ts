import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(request: Request) {
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

    const apiUrl = `https://api.2basketballbundesliga.de/spielplan/${liga}/${saison}/${apiKey}`;

    try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Fehler beim Abruf der Liga-API' },
                { status: 502 },
            );
        }

        const data = await response.json();

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, max-age=3600',
            }
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Interner Serverfehler' },
            { status: 500 },
        );
    }
}
