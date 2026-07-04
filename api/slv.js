const BASE_URL =
  "https://dataportal.livsmedelsverket.se/livsmedel/api/v1";

module.exports = async function handler(req, res) {
  try {
    const { path, ...params } = req.query;

    if (!path || typeof path !== "string") {
      return res.status(400).json({
        error: "Missing path",
        query: req.query,
      });
    }

    const allowed =
      path === "livsmedel" ||
      /^livsmedel\/\d+\/naringsvarden$/.test(path);

    if (!allowed) {
      return res.status(400).json({
        error: "Invalid path",
        path,
      });
    }

    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(item => searchParams.append(key, String(item)));
      } else if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const url =
      `${BASE_URL}/${path}` +
      (searchParams.toString() ? `?${searchParams.toString()}` : "");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SmartPortion/1.0",
      },
    });

    const text = await response.text();

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/json"
    );

    return res.status(response.status).send(text);
  } catch (error) {
    return res.status(500).json({
      error: "SLV proxy failed",
      message: error && error.message ? error.message : String(error),
    });
  }
};