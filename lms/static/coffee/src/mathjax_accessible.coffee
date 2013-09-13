# detect if there is mathjax on the page
# if not, remove mathplugin div
if not MathJax?
	if not mj?
		mj = $(".accessible-mathjax").detach()
else
	if mj?
    	mj.prependTo('body')
