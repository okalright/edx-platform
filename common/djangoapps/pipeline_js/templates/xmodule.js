define(["jquery", "mathjax", "codemirror", "tinymce", "jquery.tinymce"], function($, MathJax, CodeMirror, tinyMCE) {
    window.$ = $;
    window.MathJax = MathJax;
    window.CodeMirror = CodeMirror;
    window.tinyMCE = tinyMCE;

    var urls = ${urls};
    var head = $("head");
    $.each(urls, function(i, url) {
        head.append($("<script/>", {src: url}));
    });
    return window.XModule;
});
