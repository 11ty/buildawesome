import fs from 'fs';
import { RenderPlugin } from '../../src/Core.js';
const { RenderManager } = RenderPlugin;

export default function($config) {
	const rm = new RenderManager();

	$config.on('eleventy.config', cfg => {
		rm.templateConfig = cfg;
	});

	$config.addAsyncShortcode('promo', async function (promoType) {
		let content = fs.readFileSync('./test/stubs-3810/_includes/promo.njk').toString();

		const fn = await rm.compile(content, 'njk');

		return fn({ promoType });
	});
}

export const config = {
	markdownTemplateEngine: "njk",
}