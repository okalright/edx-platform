
# TODO: write tests for syncCollections
  describe "Transcripts.Utils", ->
    utils = Transcripts.Utils
    videoId = "OEoXaMPEzfM"
    ytLinksList = [
      "http://www.youtube.com/watch?v=#{videoId}&feature=feedrec_grec_index",
      "http://www.youtube.com/user/IngridMichaelsonVEVO#p/a/u/1/#{videoId}",
      "http://www.youtube.com/v/#{videoId}?fs=1&amp;hl=en_US&amp;rel=0",
      "http://www.youtube.com/watch?v=#{videoId}#t=0m10s",
      "http://www.youtube.com/embed/#{videoId}?rel=0",
      "http://www.youtube.com/watch?v=#{videoId}",
      "http://youtu.be/#{videoId}"
    ]
    html5FileName = "file_name"
    html5LinksList =
      mp4: [
        "http://somelink.com/#{html5FileName}.mp4?param=1&param=2#hash",
        "http://somelink.com/#{html5FileName}.mp4#hash",
        "http://somelink.com/#{html5FileName}.mp4?param=1&param=2",
        "http://somelink.com/#{html5FileName}.mp4",
        "ftp://somelink.com/#{html5FileName}.mp4",
        "https://somelink.com/#{html5FileName}.mp4",
        "somelink.com/#{html5FileName}.mp4",
        "#{html5FileName}.mp4"
      ]
      webm: [
        "http://somelink.com/#{html5FileName}.webm?param=1&param=2#hash",
        "http://somelink.com/#{html5FileName}.webm#hash",
        "http://somelink.com/#{html5FileName}.webm?param=1&param=2",
        "http://somelink.com/#{html5FileName}.webm",
        "ftp://somelink.com/#{html5FileName}.webm",
        "https://somelink.com/#{html5FileName}.webm",
        "somelink.com/#{html5FileName}.webm",
        "#{html5FileName}.webm"
      ]

    describe "Method: getField", ->
      collection = undefined
      testFieldName = "test_field"
      beforeEach ->
        collection = jasmine.createSpyObj("Collection", ["findWhere"])

      it "All arguments are present", ->
        utils.getField collection, testFieldName
        expect(collection.findWhere).toHaveBeenCalledWith field_name: testFieldName

      wrongArgumentLists = [
        argName: "collection"
        list: [`undefined`, testFieldName]
      ,
        argName: "field name"
        list: [collection, `undefined`]
      ,
        argName: "field name"
        list: [`undefined`, `undefined`]
      ]
      $.each wrongArgumentLists, (index, element) ->
        it element.argName + "argument is absent", ->
          result = utils.getField.apply(this, element.list)
          expect(result).toBeUndefined()

    describe "Method: parseYoutubeLink", ->
      describe "Correct urls", ->
        $.each ytLinksList, (index, link) ->
          it link, ->
            result = utils.parseYoutubeLink(link)
            expect(result).toBe videoId

      describe "Wrong arguments ", ->
        beforeEach ->
          spyOn console, "log"

        it "no arguments", ->
          result = utils.parseYoutubeLink()
          expect(console.log).toHaveBeenCalled()

        it "wrong data type", ->
          result = utils.parseYoutubeLink(1)
          expect(console.log).toHaveBeenCalled()

        it "videoId is wrong", ->
          videoId = "wrong_id"
          link = "http://youtu.be/" + videoId
          result = utils.parseYoutubeLink(link)
          expect(result).toBeUndefined()

        wrongUrls = [
          "http://youtu.bee/#{videoId}",
          "http://youtu.be/",
          "example.com",
          "http://google.com/somevideo.mp4"
        ]
        $.each wrongUrls, (index, link) ->
          it link, ->
            result = utils.parseYoutubeLink(link)
            expect(result).toBeUndefined()

    describe "Method: parseHTML5Link", ->
      describe "Correct urls", ->
        $.each html5LinksList, (format, linksList) ->
          $.each linksList, (index, link) ->
            it link, ->
              result = utils.parseHTML5Link(link)
              expect(result).toEqual
                video: html5FileName
                type: format

      describe "Wrong arguments ", ->
        beforeEach ->
          spyOn console, "log"

        it "no arguments", ->
          result = utils.parseHTML5Link()
          expect(console.log).toHaveBeenCalled()

        it "wrong data type", ->
          result = utils.parseHTML5Link(1)
          expect(console.log).toHaveBeenCalled()

        html5WrongUrls = [
          "http://youtu.be/#{videoId}",
          "http://youtu.be/",
          "example.com",
          "http://google.com/somevideo.mp1",
          "http://google.com/somevideomp4",
          "http://google.com/somevideo_mp4",
          "http://google.com/somevideo:mp4",
          "http://google.com/somevideo",
          "http://google.com/somevideo.webm_"
        ]
        $.each html5WrongUrls, (index, link) ->
          it link, ->
            result = utils.parseHTML5Link(link)
            expect(result).toBeUndefined()

    it "Method: getYoutubeLink", ->
      videoId = "video_id"
      result = utils.getYoutubeLink(videoId)
      expectedResult = "http://youtu.be/" + videoId
      expect(result).toBe expectedResult

    describe "Method: parseLink", ->
      resultDataDict =
        html5:
          link: html5LinksList["mp4"][0]
          resp:
            mode: "html5"
            video: html5FileName
            type: "mp4"

        youtube:
          link: ytLinksList[0]
          resp:
            mode: "youtube"
            video: videoId
            type: "youtube"

        incorrect:
          link: "http://example.com"
          resp:
            mode: "incorrect"

      $.each resultDataDict, (mode, data) ->
        it mode, ->
          result = utils.parseLink(data.link)
          expect(result).toEqual data.resp

      describe "Wrong arguments ", ->
        beforeEach ->
          spyOn console, "log"

        it "no arguments", ->
          utils.parseLink()
          expect(console.log).toHaveBeenCalled()

        it "wrong data type", ->
          utils.parseLink(1)
          expect(console.log).toHaveBeenCalled()



