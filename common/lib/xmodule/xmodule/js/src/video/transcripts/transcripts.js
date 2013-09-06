(function(){

    window.Transcripts = window.Transcripts || {};


    Transcripts.Utils = (function(){

        var _getField = function(collection, field_name) {
            var model;

            if (collection && field_name) {
                model = collection.findWhere({
                    field_name: field_name
                });
            }

            return model;
        };

        // These are the types of URLs supported:
        // http://www.youtube.com/watch?v=0zM3nApSvMg&feature=feedrec_grec_index
        // http://www.youtube.com/user/IngridMichaelsonVEVO#p/a/u/1/QdK8U-VIH_o
        // http://www.youtube.com/v/0zM3nApSvMg?fs=1&amp;hl=en_US&amp;rel=0
        // http://www.youtube.com/watch?v=0zM3nApSvMg#t=0m10s
        // http://www.youtube.com/embed/0zM3nApSvMg?rel=0
        // http://www.youtube.com/watch?v=0zM3nApSvMg
        // http://youtu.be/0zM3nApSvMg
        var _youtubeParser = (function() {
            var cache = {};

            return function(url) {
                if (typeof url !== 'string') {
                    console.log('Transcripts.Utils.parseYoutubeLink');
                    console.log('TypeError: Wrong argument type.');

                    return false;
                }

                if (cache[url]) {
                    return cache[url];
                }

                var regExp = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#\&\?]*).*/;
                var match = url.match(regExp);
                cache[url] = (match && match[1].length === 11) ? match[1] : void(0);

                return cache[url];
            };
        }());

        var _videoLinkParser = (function() {
            var cache = {};

            return function (url) {

                if (typeof url !== 'string') {
                    console.log('Transcripts.Utils.parseHTML5Link');
                    console.log('TypeError: Wrong argument type.');

                    return false;
                }

                if (cache[url]) {
                    return cache[url];
                }

                var link = document.createElement('a'),
                    match;

                link.href = url;
                match = link.pathname
                            .split('/')
                            .pop()
                            .match(/(.+)\.(mp4|webm)$/);

                if (match) {
                    cache[url] = {
                        video: match[1],
                        type: match[2]
                    };
                }

                return cache[url];
            };
        }());

        var _linkParser = function(url){
            var result;

            if (typeof url !== 'string') {
                console.log('Transcripts.Utils.parseLink');
                console.log('TypeError: Wrong argument type.');

                return false;
            }

            if (_youtubeParser(url)) {
                result = {
                    mode: 'youtube',
                    video: _youtubeParser(url),
                    type: 'youtube'
                };
            } else if (_videoLinkParser(url)) {
                result = $.extend({mode: 'html5'}, _videoLinkParser(url));
            } else {
                result = {
                    mode: 'incorrect'
                };
            }

            return result;
        };

        var _getYoutubeLink = function(video_id){
            return 'http://youtu.be/' + video_id;
        };

        var _syncCollections = function (fromCollection, toCollection) {
            fromCollection.each(function(m) {
                var model = toCollection.findWhere({
                        field_name: m.getFieldName()
                    });

                if (model) {
                    model.setValue(m.getDisplayValue());
                }
            });
        };

        return {
            getField: _getField,
            parseYoutubeLink: _youtubeParser,
            parseHTML5Link: _videoLinkParser,
            parseLink: _linkParser,
            getYoutubeLink: _getYoutubeLink,
            syncCollections: _syncCollections
        };
    }());


    Transcripts.Editor = Backbone.View.extend({

        tagName: 'div',

        initialize: function() {
            var metadata = this.$el.data('metadata'),
                models = this.toModels(metadata);

            this.collection = new CMS.Models.MetadataCollection(models);

            this.metadataEditor = new CMS.Views.Metadata.Editor({
                el: this.$el,
                collection: this.collection
            });
        },

        // Convert metadata JSON to List of models
        toModels: function(data) {
            var metadata = (_.isString(data)) ? JSON.parse(data) : data,
                models = [];

            for (var model in metadata){
                if (metadata.hasOwnProperty(model)) {
                    models.push(metadata[model]);
                }
            }

            return models;
        },

        syncBasicTab: function(metadataCollection) {
            var result = [],
                utils = Transcripts.Utils,
                getField = utils.getField,
                html5SourcesValue, youtubeValue, videoUrl;

            if (!metadataCollection) {
                return false;
            }

            html5SourcesValue = getField(metadataCollection, 'html5_sources')
                                    .getDisplayValue();

            youtubeValue = getField(metadataCollection, 'youtube_id_1_0')
                                    .getDisplayValue();

            videoUrl = getField(this.collection,'video_url');

            youtubeValue = (youtubeValue.length === 11)
                                ? utils.getYoutubeLink(youtubeValue)
                                : '';

            result.push(youtubeValue);
            result = result.concat(html5SourcesValue);

            videoUrl.setValue(result);
            utils.syncCollections(metadataCollection, this.collection);
        },

        syncAdvancedTab: function(metadataCollection) {
            var utils = Transcripts.Utils,
                getField = utils.getField,
                html5Sources, youtube, videoUrlValue, result;


            if (!metadataCollection) {
                return false;
            }

            html5Sources = getField(
                                metadataCollection,
                                'html5_sources'
                            );

            youtube = getField(
                                metadataCollection,
                                'youtube_id_1_0'
                            );

            videoUrlValue = getField(this.collection, 'video_url')
                                .getDisplayValue();

            result = _.groupBy(
                videoUrlValue,
                function(value) {
                    return utils.parseLink(value).mode;
                }
            );


            // TODO: CHECK result['html5']
            if (html5Sources) {
                html5Sources.setValue(result.html5 || []);
            }

            if (youtube) {
                result = (result.youtube)
                            ? utils.parseLink(result.youtube[0]).video
                            : '';

                youtube.setValue(result);
            }

            utils.syncCollections(this.collection, metadataCollection);
        }

    });


    CMS.Views.Metadata.VideoList = CMS.Views.Metadata.AbstractEditor.extend({

        events : {
            'click .setting-clear' : 'clear',
            'keypress .setting-input' : 'showClearButton',
            'change input' : 'updateModel',
            'click .collapse-setting' : 'toggleAdditional'
        },

        templateName: 'metadata-videolist-entry',
        placeholders: {
            'webm': '.webm',
            'mp4': 'http://somesite.com/video.mp4',
            'youtube': 'http://youtube.com/'
        },

        initialize: function() {
            CMS.Views.Metadata.AbstractEditor.prototype.initialize
                .apply(this, arguments);

            this.$el.on(
                'input', 'input',
                _.debounce(_.bind(this.checkValidity, this), 300)
            );

            this.messanger = new Transcripts.MessageManager({
                container: this.$el
            });
        },

        getValueFromEditor: function () {
            return _.map(
                this.$el.find('.input'),
                function (ele) { return ele.value.trim(); }
            ).filter(_.identity);
        },

        setValueInEditor: function (value) {
            var list = this.$el.find('.input'),
                val = value.filter(_.identity),
                placeholders = this.getPlaceholders(val);

            for (var i = 0; i < 3; i += 1) {
                list.eq(i)
                    .val(val[i] || null)
                    .attr('placeholder', placeholders[i]);
            }

            if (value.length > 1) {
                this.openAdditional();
            } else {
                this.closeAdditional();
            }
        },

        getPlaceholders: function (value) {
            var parseLink = Transcripts.Utils.parseLink,
                placeholders = _.clone(this.placeholders),
                result = [],
                label, type;

            for (var i = 0; i < 3; i += 1) {
                type = parseLink(value[i]).type;

                if (placeholders[type]) {
                    label = placeholders[type];
                    delete placeholders[type];
                } else {
                    placeholders = _.values(placeholders);
                    label = placeholders.pop();
                }

                result.push(label);
            }

            return result;
        },

        openAdditional: function(event) {
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            this.$el.find('.videolist-additional').addClass('is-visible');
        },

        closeAdditional: function(event) {
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            this.$el.find('.videolist-additional').removeClass('is-visible');
        },

        toggleAdditional: function(event) {
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            if (this.$el.find('.videolist-additional').hasClass('is-visible')) {
                this.closeAdditional.apply(this, arguments);
            } else {
                this.openAdditional.apply(this, arguments);
            }
        },

        checkValidity: function(event){

            if (event && event.preventDefault) {
                event.preventDefault();
            }

            var entry = $(event.currentTarget).val(),
                data = Transcripts.Utils.parseLink(entry);

            switch (data.mode) {
                case 'youtube':
                    this.fetchCaptions(data.video)
                        .always(function(response, statusText){
                            if (response.status === 200) {
                                console.log(arguments);
                            } else {
                                console.log('No caption!!!');
                            }
                        });
                    break;

                case 'html5':

                    this.openAdditional();
                    break;
            }

            console.log(data);
        },

        fetchCaptions: function(video_id){
            if (this.xhr && this.xhr.abort) this.xhr.abort();

            this.xhr = $.ajax({
                url: 'http://video.google.com/timedtext',
                data: {
                    lang: 'en',
                    v: video_id
                },
                timeout: 1500,
                dataType: 'jsonp'
            });

            return this.xhr;
        }
    });


    Transcripts.MessageManager = Backbone.View.extend({
        tagName: 'div',
        elClass: '.wrapper-transcripts-message',

        events: {

        },

        templates: {
            found: "#transcripts-found", // on edx
            not_found: "#transcripts-not-found", // no found on both, type: HTML5, YT (no on yt)
            on_youtube: "#transcripts-on-youtube", // no found on EDX, mode: YT
            not_updated: "#transcripts-not-updated", // change source, type: HTML5
            uploaded:  "#transcripts-uploaded", // when subtitles was uploaded, type: HTML5
            conflict:  "#transcripts-conflict", // add YT to existing HTML5 with subs, type: YT
        },

        initialize: function () {
            console.log('messanger');
        },

        render: function (template) {
            var tpl = $(this.templates[template]).text();

            if(!tpl) {
                console.error("Couldn't load Transcripts status template");
            }
            this.template = _.template(tpl);
            this.options.container.find(this.elClass).html(this.template());
        }

    });


}(this));
