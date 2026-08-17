const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");
const speakeasy = require("speakeasy");
const { prisma } = require("../../shared/prisma");

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  totpEnabled: true,
  createdAt: true,
};

class TwoFactorError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function createTwoFactorService({
  prismaClient = prisma,
  passwordLibrary = bcrypt,
  totpLibrary = speakeasy,
  qrCodeLibrary = QRCode,
} = {}) {
  async function setup(userId) {
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new TwoFactorError("USER_NOT_FOUND", 404);
    }

    const secret = totpLibrary.generateSecret({
      name: `FlowHub (${user.email})`,
      issuer: "FlowHub",
      length: 20,
    });

    await prismaClient.user.update({
      where: { id: userId },
      data: {
        totpSecret: secret.base32,
        totpEnabled: false,
      },
    });

    const qrCodeDataUrl = await qrCodeLibrary.toDataURL(secret.otpauth_url, {
      type: "image/png",
      margin: 1,
      scale: 6,
    });

    return {
      qrCodeDataUrl,
      otpauthUrl: secret.otpauth_url,
    };
  }

  async function verify(userId, code) {
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { id: true, totpSecret: true },
    });

    if (!user) {
      throw new TwoFactorError("USER_NOT_FOUND", 404);
    }

    if (!user.totpSecret) {
      throw new TwoFactorError("TOTP_NOT_CONFIGURED", 409);
    }

    const valid = totpLibrary.totp.verify({
      secret: user.totpSecret,
      encoding: "base32",
      token: code,
      window: 1,
    });

    if (!valid) {
      throw new TwoFactorError("INVALID_TOTP_CODE", 400);
    }

    return prismaClient.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
      select: PUBLIC_FIELDS,
    });
  }

  async function disable(userId, password) {
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, totpEnabled: true, totpSecret: true },
    });

    if (!user) {
      throw new TwoFactorError("USER_NOT_FOUND", 404);
    }

    if (!user.passwordHash) {
      throw new TwoFactorError("PASSWORD_NOT_SET", 400);
    }

    const valid = await passwordLibrary.compare(password, user.passwordHash);
    if (!valid) {
      throw new TwoFactorError("INVALID_PASSWORD", 401);
    }

    return prismaClient.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecret: null,
      },
      select: PUBLIC_FIELDS,
    });
  }

  return { setup, verify, disable };
}

const twoFactorService = createTwoFactorService();

module.exports = { ...twoFactorService, createTwoFactorService, TwoFactorError };