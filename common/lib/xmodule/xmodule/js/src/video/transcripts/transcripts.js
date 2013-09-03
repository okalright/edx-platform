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
                if (cache[url]) {
                    return cache[url];
                }

                var regExp = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#\&\?]*).*/;
                var match = url.match(regExp);
                cache[url] = (match && match[1].length === 11) ? match[1] : false;

                return cache[url];
            };
        }());

        var _videoLinkParser = (function() {
            var cache = {};

            return function (url) {
                if (cache[url]) {
                    return cache[url];
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
                    cache[url] = {
                        name: match[1],
                        format: match[2]
                    }
                }

                return cache[url];
            };
        }());

        var _linkParser = function(url){
            var result;

            if (typeof url !== "string") {
                console.log("Transcripts.Utils.parseLink");
                console.log("TypeError: Wrong argument type.");

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
        }
    }());


    Transcripts.Editor = Backbone.View.extend({

        tagName: "div",

        initialize: function() {
            var self = this,
                metadata = this.$el.data('metadata'),
                models = this.toModels(metadata);

            this.collection = new CMS.Models.MetadataCollection(models);

            this.metadataEditor = new CMS.Views.Metadata.Editor({
                el: this.$el,
                collection: this.collection
            });
        },

        render: function() {
        },

        // Convert metadata JSON to List of models
        toModels: function(data) {
            var metadata = (_.isString(data)) ? JSON.parse(data) : data,
                models = [];

            for (model in metadata){
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

            youtubeValue = (youtubeValue)
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
                    return utils.parseLink(value).type;
                }
            );

            if (html5Sources) {
                html5Sources.setValue(result['html5'] || []);
            }

            if (youtube) {
                result = (result['youtube'])
                            ? utils.parseLink(result['youtube'][0]).data
                            : '';

                youtube.setValue(result);
            }

            utils.syncCollections(this.collection, metadataCollection);
        }

    });


    CMS.Views.Metadata.VideoList = CMS.Views.Metadata.AbstractEditor.extend({

        events : {
            "click .setting-clear" : "clear",
            "keypress .setting-input" : "showClearButton",
            "change input" : "updateModel",
            "click .collapse-setting" : "toggleAdditional",
            "input input" : "checkValidity"
        },

        templateName: "metadata-videolist-entry",

        initialize: function() {
            var self = this;

            CMS.Views.Metadata.AbstractEditor.prototype.initialize
                .apply(this, arguments);
        },

        getValueFromEditor: function () {
            return _.map(
                this.$el.find('.input'),
                function (ele) { return ele.value.trim(); }
            ).filter(_.identity);
        },

        // TODO: Think about mehtod of creation
        setValueInEditor: function (value) {
            var list = this.$el.find('.input'),
                value = value.filter(_.identity);

            for (var i = 0; i < 3; i += 1) {
                list.eq(i).val(value[i] || null);
            }

            if (value.length > 1) {
                this.openAdditional();
            } else {
                this.closeAdditional();
            }
        },

        openAdditional: function(event) {
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            this.$el.find('.videolist-settings').addClass('is-visible');
            this.$el.find('.collapse-setting').addClass('is-disabled');
        },

        closeAdditional: function(event) {
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            this.$el.find('.videolist-settings').removeClass('is-visible');
            this.$el.find('.collapse-setting').removeClass('is-disabled');
        },

        toggleAdditional: function(event) {
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            if (this.$el.find('.videolist-settings').hasClass('is-visible')) {
                this.closeAdditional.apply(this, arguments);
            } else {
                this.openAdditional.apply(this, arguments);
            }

        },

        checkValidity: (function(event){
            var checker = function(event){
                var entry = $(event.currentTarget).val(),
                    data = Transcripts.Utils.parseLink(entry);

                    switch (data.type) {
                        case 'youtube':
                            this.fetchCaptions(data.data)
                                .always(function(response, statusText){
                                    if (response.status === 200) {
                                       console.log(arguments);
                                    } else {
                                        console.log('No caption!!!');
                                    }
                                });
                            break;
                        case 'html5':

                            break;
                    }

                    console.log(data)
            };

            return _.debounce(checker, 300);
        }()),

        fetchCaptions: function(video_id){
            var xhr = $.ajax({
                url: 'http://video.google.com/timedtext',
                data: {
                    lang: 'en',
                    v: video_id
                },
                timeout: 1500,
                dataType: 'jsonp'
            });

            return xhr;
        }
    });

}(this));
