/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { RestAPI } from "@webpack/common";

export const settings = definePluginSettings({
    provider: {
        type: OptionType.SELECT,
        description: "Choose your preferred GIF provider",
        options: [
            { label: "Tenor (Default)", value: "tenor", default: true },
            { label: "Giphy (API key required)", value: "giphy" },
            { label: "Klipy (API key required)", value: "klipy" },
            { label: "Serika GIFs", value: "serika" },
            { label: "Imgur (API key required)", value: "imgur" },
        ],
    },
    giphyApiKey: {
        type: OptionType.STRING,
        description: "Giphy API key (get one at developers.giphy.com)",
        default: "",
    },
    klipyApiKey: {
        type: OptionType.STRING,
        description: "Klipy API key",
        default: "",
    },
    imgurClientId: {
        type: OptionType.STRING,
        description: "Imgur Client ID (get one at api.imgur.com)",
        default: "",
    },
    serikaInstance: {
        type: OptionType.STRING,
        description: "Serika GIFs instance URL",
        default: "https://gifs.serika.dev",
    },
    serikaApiKey: {
        type: OptionType.STRING,
        description: "Serika GIFs API key (optional, bypasses rate limits)",
        default: "",
    },
});

// Transform Giphy response to Discord GIF format
function transformGiphyToDiscord(data: any) {
    return (data.data || []).map((gif: any) => ({
        id: gif.id,
        title: gif.title || "",
        url: gif.images?.original?.url || gif.images?.downsized?.url,
        src: gif.images?.original?.url || gif.images?.downsized?.url,
        gif_src: gif.images?.original?.url || gif.images?.downsized?.url,
        width: parseInt(gif.images?.original?.width) || 200,
        height: parseInt(gif.images?.original?.height) || 200,
        preview: gif.images?.fixed_height_small?.url || gif.images?.preview_gif?.url || gif.images?.downsized_small?.url
    }));
}

// Transform Serika response to Discord GIF format
function transformSerikaToDiscord(data: any) {
    const gifs = data.gifs || data.data || [];
    return gifs.map((gif: any) => ({
        id: gif.id?.toString() || gif.slug || Math.random().toString(36),
        title: gif.title || "",
        url: gif.url || gif.originalUrl,
        src: gif.url || gif.originalUrl,
        gif_src: gif.url || gif.originalUrl,
        width: gif.width || 200,
        height: gif.height || 200,
        preview: gif.thumbnailUrl || gif.previewUrl || gif.url
    }));
}

// Transform Imgur response to Discord GIF format
function transformImgurToDiscord(data: any) {
    const items = (data.data || []).filter((item: any) =>
        item.animated || item.type?.includes("gif") || item.mp4 || item.link?.endsWith(".gif")
    );
    return items.map((gif: any) => ({
        id: gif.id,
        title: gif.title || "",
        url: gif.mp4 || gif.link,
        src: gif.mp4 || gif.link,
        gif_src: gif.link,
        width: gif.width || 200,
        height: gif.height || 200,
        preview: gif.link?.replace(".gif", "s.gif") || gif.link
    }));
}

// Transform Klipy response to Discord GIF format
function transformKlipyToDiscord(data: any) {
    const results = data.results || data.data || [];
    return results.map((gif: any) => ({
        id: gif.id,
        title: gif.title || "",
        url: gif.gif_url || gif.media?.gif?.url || gif.url,
        src: gif.gif_url || gif.media?.gif?.url || gif.url,
        gif_src: gif.gif_url || gif.media?.gif?.url || gif.url,
        width: gif.width || 200,
        height: gif.height || 200,
        preview: gif.preview_url || gif.media?.preview?.url || gif.url
    }));
}

async function fetchFromProvider(query: string, limit: number, type: "search" | "trending") {
    const provider = settings.store.provider;
    console.log(`[GifProvider] fetchFromProvider: ${type}, query="${query}", provider=${provider}`);

    switch (provider) {
        case "giphy": {
            const apiKey = settings.store.giphyApiKey?.trim();
            if (!apiKey) throw new Error("Giphy API key required");

            const endpoint = type === "search"
                ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&limit=${limit}&api_key=${apiKey}`
                : `https://api.giphy.com/v1/gifs/trending?limit=${limit}&api_key=${apiKey}`;

            const res = await fetch(endpoint);
            const data = await res.json();
            return transformGiphyToDiscord(data);
        }

        case "serika": {
            const baseUrl = settings.store.serikaInstance.replace(/\/$/, "");
            const apiKey = settings.store.serikaApiKey?.trim();

            const headers: Record<string, string> = {};
            if (apiKey) headers["X-API-Key"] = apiKey;

            const endpoint = type === "search"
                ? `${baseUrl}/api/gifs?search=${encodeURIComponent(query)}&limit=${limit}`
                : `${baseUrl}/api/gifs?sort=views&limit=${limit}`;

            console.log(`[GifProvider] Fetching from Serika: ${endpoint}`);
            const res = await fetch(endpoint, { headers });
            const data = await res.json();
            console.log(`[GifProvider] Serika response:`, data);
            return transformSerikaToDiscord(data);
        }

        case "imgur": {
            const clientId = settings.store.imgurClientId?.trim();
            if (!clientId) throw new Error("Imgur Client ID required");

            const endpoint = type === "search"
                ? `https://api.imgur.com/3/gallery/search?q=${encodeURIComponent(query)}&q_type=anigif`
                : `https://api.imgur.com/3/gallery/hot/viral/0`;

            const res = await fetch(endpoint, {
                headers: { Authorization: `Client-ID ${clientId}` }
            });
            const data = await res.json();
            return transformImgurToDiscord(data).slice(0, limit);
        }

        case "klipy": {
            const apiKey = settings.store.klipyApiKey?.trim();
            if (!apiKey) throw new Error("Klipy API key required");

            const endpoint = type === "search"
                ? `https://api.klipy.co/v1/gifs/search?q=${encodeURIComponent(query)}&limit=${limit}&api_key=${apiKey}`
                : `https://api.klipy.co/v1/gifs/trending?limit=${limit}&api_key=${apiKey}`;

            const res = await fetch(endpoint);
            const data = await res.json();
            return transformKlipyToDiscord(data);
        }

        default:
            throw new Error("Unknown provider");
    }
}

// Store original RestAPI.get
let originalGet: any = null;

export default definePlugin({
    name: "GifProvider",
    description: "Switch between different GIF providers (Tenor, Giphy, Klipy, Serika GIFs, Imgur)",
    authors: [Devs.Ven],
    settings,

    start() {
        console.log(`[GifProvider] Started with provider: ${settings.store.provider}`);
        console.log(`[GifProvider] RestAPI module:`, RestAPI);
        
        // Hook into RestAPI.get to intercept GIF requests
        if (RestAPI && RestAPI.get) {
            originalGet = RestAPI.get.bind(RestAPI);
            
            RestAPI.get = function(options: any) {
                const url = options?.url || "";
                
                // Check if this is a GIF-related request
                if (settings.store.provider !== "tenor" && 
                    (url.includes("/gifs/search") || url.includes("/gifs/trending"))) {
                    
                    const isSearch = url.includes("/gifs/search");
                    const query = options?.query?.q || "";
                    
                    console.log(`[GifProvider] Intercepting ${isSearch ? "search" : "trending"} request, query="${query}"`);
                    
                    // Return a promise that fetches from our provider
                    return new Promise((resolve, reject) => {
                        fetchFromProvider(query, 50, isSearch ? "search" : "trending")
                            .then(gifs => {
                                console.log(`[GifProvider] Returning ${gifs.length} gifs`);
                                resolve({ body: gifs, ok: true, status: 200 });
                            })
                            .catch(err => {
                                console.error("[GifProvider] Error:", err);
                                // Fallback to original on error
                                originalGet(options).then(resolve, reject);
                            });
                    });
                }
                
                // Pass through to original for non-GIF requests
                return originalGet(options);
            };
            
            console.log("[GifProvider] Successfully hooked RestAPI.get");
        } else {
            console.error("[GifProvider] Could not find RestAPI module - RestAPI:", RestAPI);
        }
    },

    stop() {
        console.log("[GifProvider] Stopped");
        
        // Restore original RestAPI.get
        if (RestAPI && originalGet) {
            RestAPI.get = originalGet;
            originalGet = null;
            console.log("[GifProvider] Restored original RestAPI.get");
        }
    }
});
