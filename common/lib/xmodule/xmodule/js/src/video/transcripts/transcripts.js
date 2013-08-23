(function(){

    window.Transcripts = window.Transcripts || {};


    Transcripts.Utils = (function(){

        // These are the types of URLs supported:
        // http://www.youtube.com/watch?v=0zM3nApSvMg&feature=feedrec_grec_index
        // http://www.youtube.com/user/IngridMichaelsonVEVO#p/a/u/1/QdK8U-VIH_o
        // http://www.youtube.com/v/0zM3nApSvMg?fs=1&amp;hl=en_US&amp;rel=0
        // http://www.youtube.com/watch?v=0zM3nApSvMg#t=0m10s
        // http://www.youtube.com/embed/0zM3nApSvMg?rel=0
        // http://www.youtube.com/watch?v=0zM3nApSvMg
        // http://youtu.be/0zM3nApSvMg
        var _youtubeParser = function(url) {
            this.cache = this.cache || {};

            if (this.cache[url]) {
                return this.cache[url];
            }

            var regExp = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#\&\?]*).*/;
            var match = url.match(regExp);
            this.cache[url] = (match && match[1].length === 11) ? match[1] : false;

            return this.cache[url];
        };

        var _videoLinkParser = function(url) {
            this.cache = this.cache || {};

            if (this.cache[url]) {
                return this.cache[url];
            }

            var link = document.createElement('a'),
                result = false,
                match;

            link.href = url;
            match = link.pathname
                        .split('/')
                        .pop()
                        .match(/(.+)\.(mp4|webm)$/);

            if (match) {
                this.cache[url] = {
                    name: match[1],
                    format: match[2]
                }
            }

            return this.cache[url];
        };


        return {
            parseLink: function(url){
                var result;

                if (typeof url !== "string") {
                    console.log("Wrong url format.");

                    return false;
                }

                if (_youtubeParser(url)) {
                    result = {
                        type: 'youtube',
                        data: _youtubeParser(url)
                    };
                } else if (_videoLinkParser(url)) {
                    result = {
                        type: 'html5',
                        data: _videoLinkParser(url)
                    };
                } else {
                    result = {
                        type: 'incorrect'
                    };
                }

                return result;
            }
        }
    }());


    Transcripts.Editor = Backbone.View.extend({

        tagName: "div",

        initialize: function() {
            var metadata = this.$el.data('metadata'),
                models = this.toModels(metadata);

            this.collection = new CMS.Models.MetadataCollection(models);

            this.metadataEditor = new CMS.Views.Metadata.Editor({
                el: this.$el,
                collection: this.collection
            })

        },

        render: function() {
        },

        // Convert metadata JSON to List of models
        toModels: function(data) {
            var metadata = (_.isString(data)) ? parseJSON(data) : data,
                models = [];

            for (model in metadata){
                if (metadata.hasOwnProperty(model)) {
                    models.push(metadata[model]);
                }
            }

            return models;
        }

    });


    CMS.Views.Metadata.VideoList = CMS.Views.Metadata.AbstractEditor.extend({

        events : {
            "click .setting-clear" : "clear",
            "keypress .setting-input" : "showClearButton",
            "change input" : "updateModel",
            "click .collapse-setting" : "addAdditionalVideos",
            "input input" : "checkValidity"
        },

        templateName: "metadata-videolist-entry",

        getValueFromEditor: function () {
            return _.map(
                this.$el.find('.input'),
                function (ele) { return ele.value.trim(); }
            ).filter(_.identity);
        },

        setValueInEditor: function (value) {

            var list = this.$el.find('ol'),
                url = this.$el.find('.wrapper-videolist-url input');

            list.empty();

            if (value.length < 3) {

            }

            _.each(value, function(ele, index) {
                if (index != 0) {
                    var template = _.template(
                        '<li class="videolist-settings-item">' +
                            '<input type="text" class="input" value="<%= ele %>">' +
                        '</li>'
                    );
                    list.append($(template({'ele': ele, 'index': index})));
                }
            });
            url.val(value[0]);
        },

        addAdditionalVideos: function(event) {
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            this.$el.find('.videolist-settings').addClass('is-visible');
            this.$el.find('.collapse-setting').addClass('is-disabled');
        },

        checkValidity: (function(event){
            var checker = function(event){
                var entry = $(event.currentTarget).val(),
                    data = Transcripts.Utils.parseLink(entry);

                    console.log(data)
            };

            return _.debounce(checker, 300);
        }())

    });


}(this));