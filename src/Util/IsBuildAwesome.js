export function isUsingBuildAwesome() {
	return process?.env?.BUILDAWESOME_PACKAGE === "@awesome.me/buildawesome";
}
