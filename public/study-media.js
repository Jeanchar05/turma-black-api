"use strict";
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TurmaMedia = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  function parse(value, kind = "module") {
    if (!value) return null;
    let url;
    try {
      url = new URL(String(value));
    } catch {
      return null;
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    const host = url.hostname.toLowerCase(),
      parts = url.pathname.split("/").filter(Boolean);
    if (kind === "instagram") {
      if (
        !["instagram.com", "www.instagram.com"].includes(host) ||
        !["p", "reel", "tv"].includes(parts[0]) ||
        !/^[A-Za-z0-9_-]{5,64}$/.test(parts[1] || "") ||
        parts.length !== 2
      )
        return null;
      const canonical = `https://www.instagram.com/${parts[0]}/${parts[1]}/`;
      return {
        provider: "instagram",
        url: canonical,
        embed: canonical + "embed/",
      };
    }
    if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
        "youtu.be",
      ].includes(host)
    ) {
      const id =
        host === "youtu.be"
          ? parts[0]
          : parts[0] === "watch"
            ? url.searchParams.get("v")
            : ["embed", "shorts", "live"].includes(parts[0])
              ? parts[1]
              : "";
      if (!/^[A-Za-z0-9_-]{11}$/.test(id || "")) return null;
      return {
        provider: "youtube",
        id,
        url: `https://www.youtube.com/watch?v=${id}`,
        embed: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
    if (/\.(mp4|webm)$/i.test(url.pathname))
      return { provider: "file", url: url.href };
    return null;
  }
  return { parse };
});
