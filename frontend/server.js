//simple express server to run frontend production build;
const express = require("express");
const path = require("path");
const app = express();
// index: false - o HTML da SPA e servido explicitamente abaixo (sem suporte
// a Range), pra sempre responder 200 e nao 206 a crawlers como o da Meta.
// Os demais arquivos estaticos (JS/CSS/midia) continuam com Range normal.
app.use(express.static(path.join(__dirname, "build"), { index: false }));
app.get("/*", function (req, res) {
	res.sendFile(path.join(__dirname, "build", "index.html"), { acceptRanges: false });
});
app.listen(3000);

