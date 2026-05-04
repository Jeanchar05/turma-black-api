const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = "TURMA_BLACK_SECRET";

// 🔗 CONECTAR MONGO (depois você coloca o link)
mongoose.connect("SUA_URL_MONGODB");

// MODELO
const User = mongoose.model("User", {
  email: String,
  senha: String,
  nome: String,
  aprovado: Boolean,
  suspenso: Boolean,
  codigo: String,
  plano: String,
  fimISO: String,
  dispositivos: Array
});

// ==========================
// CRIAR CONTA
// ==========================
app.post("/criar", async (req, res) => {
  const { email, senha } = req.body;

  const existe = await User.findOne({ email });
  if (existe) return res.json({ erro: "Já existe" });

  const codigo = Math.floor(100000 + Math.random() * 900000).toString();

  await User.create({
    email,
    senha,
    nome: email.split("@")[0],
    aprovado: false,
    suspenso: false,
    codigo,
    plano: "Turma Black",
    dispositivos: []
  });

  res.json({ sucesso: true, codigo });
});

// ==========================
// LOGIN
// ==========================
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  const user = await User.findOne({ email, senha });
  if (!user) return res.json({ erro: "Login inválido" });

  if (user.suspenso) return res.json({ erro: "Conta suspensa" });
  if (!user.aprovado) return res.json({ erro: "Não aprovado", codigo: user.codigo });

  const token = jwt.sign({ id: user._id }, SECRET);

  res.json({ token });
});

// ==========================
// APROVAR
// ==========================
app.post("/aprovar", async (req, res) => {
  const { codigo } = req.body;

  const user = await User.findOne({ codigo });
  if (!user) return res.json({ erro: "Código inválido" });

  user.aprovado = true;
  await user.save();

  res.json({ sucesso: true });
});

// ==========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});