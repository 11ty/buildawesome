export default function($config) {
	$config.on("buildawesome.after", () => {
		throw new Error("after listener failed");
	});
}
