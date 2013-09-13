# detect if there is mathjax on the page
# if not, remove mathplugin div
if not MathJax?
	$(".accessible-mathjax").remove()
