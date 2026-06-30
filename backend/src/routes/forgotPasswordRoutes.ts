import express from "express";
import rateLimit from "express-rate-limit";
import isAuth from "../middleware/isAuth";
import * as ForgotController from "../controllers/ForgotController";
const forgotsRoutes = express.Router();

const forgotRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." }
});

forgotsRoutes.post("/forgetpassword/:email", forgotRateLimit, ForgotController.store);
forgotsRoutes.post(
  "/resetpasswords/:email/:token/:password",
  ForgotController.resetPasswords
);
export default forgotsRoutes;
