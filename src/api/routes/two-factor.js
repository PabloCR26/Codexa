const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/requireAuth");
const { verifySchema } = require("../validators/twoFactor");
const twoFactorService = require("../services/twoFactor");

const twoFactorRouter = express.Router();

twoFactorRouter.use(requireAuth);

twoFactorRouter.post(
	"/setup",
	asyncHandler(async (request, response) => {
		const result = await twoFactorService.setup(request.userId);
		response.json(result);
	}),
);

twoFactorRouter.post(
	"/verify",
	asyncHandler(async (request, response) => {
		const parsed = verifySchema.safeParse(request.body);
		if (!parsed.success) {
			return response.status(400).json({
				error: "VALIDATION_ERROR",
				details: parsed.error.flatten().fieldErrors,
			});
		}

		const user = await twoFactorService.verify(request.userId, parsed.data.code);
		response.json(user);
	}),
);

module.exports = { twoFactorRouter };
