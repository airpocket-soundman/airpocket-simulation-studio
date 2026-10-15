const fetchRequestAnchor = '        const r = event.request;';

export function buildCoiServiceworker(source) {
    const matches = source.split(fetchRequestAnchor).length - 1;
    if (matches !== 1) {
        throw new Error(`Expected one coi-serviceworker fetch request anchor, found ${matches}`);
    }

    return source.replace(
        fetchRequestAnchor,
        `${fetchRequestAnchor}\n        const requestUrl = new URL(r.url);\n        if (requestUrl.origin !== self.location.origin && requestUrl.protocol === "http:" && /^http:\\/\\/127\\.0\\.0\\.1(?::\\d+)?(?:[/?#]|$)/i.test(r.url)) {\n            return;\n        }`
    );
}
