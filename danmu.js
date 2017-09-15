/**
 * 自制的H5弹幕播放插件
 */

(function(window) {

  /**
   * [弹幕构造函数，用于初始化一个弹幕插件]
   * @param {string} className [类选择器，如果有重复的话，则取第一个]
   * @param {object} options   [弹幕插件的各种参数]
   */
  window.Danmu = function(className, options) {
    this._init(className, options);
  };

  /**
   * [Danmu类初始化函数]
   * [弹幕构造函数，用于初始化一个弹幕插件]
   * @param {string} className [类选择器，如果有重复的话，则取第一个]
   * @param {object} options   [弹幕插件的各种参数]
   */
  Danmu.prototype._init = function(className, options) {
    var danmuEl = document.getElementsByClassName(className)[0];
    if (!checkIfCorrect(danmuEl)) {
      throw new Error('The DOM node of danmu plugin is in wrong position!');
    }
    var videoContainer = danmuEl.parentNode;
    var parentPostiton = Window.getComputedStyle(videoContainer).position;  //获取当前父亲容器的position
    if (parentPostiton == 'static') {
      videoContainer.style.position = 'relative';                           //需要的时候设置为relative，用于弹幕绝对布局的基准
    }
    var videoWidth = videoContainer.offsetWidth,
        videoHeight = videoContainer.offsetHeight;

    var trackHeight = (options && options.traceHeight) || 12;
    var remainder = videoHeight % trackHeight;
    var trackNum = Math.floor(videoHeight / trackHeight);

    this.traceHeight = videoHeight; //轨道高度
    this.traceWidth = videoWidth; //轨道宽度
    this.traceList = [];  //轨道列表
    this.danmuList = [];  //弹幕列表
    this.el = danmuEl;    //弹幕DOM元素

    for (var i = 0; i < trackNum; i++) {
      if (i == trackNum - 1) {
        this.traceList.push(new Track(trackHeight + remainder));
      }
      else {
        this.traceList.push(new Track(trackHeight));
      }
    }
  };

  /**
   * [弹幕插件更新弹幕数据]
   * @param {Array[object]} [danmuList] [新插入弹幕插件的弹幕]
   */
  Danmu.prototype._updateDanmuList = function(danmuList) {
    if (Object.prototype.toString.call(danmuList) !== '[object Array]') {
      throw new Error('The danmu data format is wrong!');
    }
    this.danmuList.concat(danmuList);
  };

  /**
   * [弹幕列表中的弹幕定时请求轨道]
   * @return {[type]} [description]
   */
  Danmu.prototype._requestTrack = function() {
    this.reqTrackTimer = setInterval(function() {
      for (var i = 0, danmuLen = this.danmuList.length; i < danmuLen; i++) {
        if (this.danmuList[i].isScroll) {
          continue; //弹幕已经在轨道中滚动
        }
        for (var j = 0, trackLen = this.traceList.length; j < trackLen; j++) {
          if (this.traceList[j].isExistWaitDanmu) { //还有未完全进入video视口的弹幕，轨道不能用
            continue;
          }
          if (this.danmuList[i].size > this.traceList[j].traceHeight) { //需要拼接轨道
            if (j == trackLen - 1) {
              continue; //没有可以拼接的轨道
            }
            else {
              var danmuSize = this.danmuList[i].size;
              var curTrackHeight = this.trackList[j].traceHeight;
              var curIndex = j + 1;
              while (curIndex < trackLen) {
                if (this.trackList[curIndex].isExistWaitDanmu) {
                  break;
                }
                curTrackHeight += this.trackList[curIndex].traceHeight;
                if (curTrackHeight > danmuSize) { //存在多个轨道拼接能够容纳该弹幕
                  for (var beginIndex = j; beginIndex <= curIndex; beginIndex++) {
                    this.trackList[beginIndex].isUsed = true;
                    this.trackList[beginIndex].isExistWaitDanmu = true;
                  }
                  this.danmuList[i].isScroll = true;
                  this._danmuScroll(i, j, curIndex);
                  break;
                }
                curIndex += 1;
              }
            }
          }
          else {
            this.traceList[j].isUsed = true;
            this.traceList[j].isExistWaitDanmu = true;
            this.danmuList[i].isScroll = true;
            this._danmuScroll(i, j, j);
          }
        }
      }
    }.bind(this), 100);
  };

  /**
   * [弹幕请求到了能够承接的轨道，开始在video上进行滚屏]
   * @param {number} [danmuIndex] [滚动的弹幕index]
   * @param {number} [beginTraceIndex] [起始的轨道index]
   * @param {number} [endTraceIndex] [结束的轨道index]
   */
  Danmu.prototype._danmuScroll = function(danmuIndex, beginTraceIndex, endTraceIndex) {
    var traceHeightSum = 0;
    for (var i = beginTraceIndex; i <= endTraceIndex; i++) {
      traceHeightSum += this.traceList[i].traceHeight;
    }
    var offsetTop = beginTraceIndex * this.traceHeight + (traceHeightSum - this.danmuList[danmuIndex]) / 2;
    var offsetLeft = this.traceWidth;
    var danmuNode = document.createElement('span');
    danmuNode.style.cssText = 'position: absolute; display: block; color: ' + this.danmuList[danmuIndex].color
                              + '; font-size: ' + this.danmuList[danmuIndex].size + 'px; top: ' + offsetTop
                              + 'px; left:' + offsetLeft + 'px;';
    this.el.appendChild(danmuNode);
  };

  /**
   * [轨道构造函数，将播放器按高度进行分割，形成一个一个轨道]
   * @param {number} [trackHeight] [轨道的高度]
   */
  function Track(trackHeight) {
    this.trackHeight = trackHeight;  //轨道的高度
    this.isUsed = false;             //轨道是否被占用，这个需要和isExistWaitDanmu区分开
    this.thresholdV = 0;             //轨道当前的弹幕限制速度
    this.isExistWaitDanmu = false;   //轨道是否存在还未完全进入video视口的弹幕
  }

  /**
   * [检查弹幕节点是否被插入正确的位置，正确的位置应该是与video元素存在同一个父亲节点之内]
   * @param  {object} danmuEl [插入DOM的弹幕插件节点]
   * @return {boolean}         [返回节点插入的正确性]
   */
  function checkIfCorrect(danmuEl) {
    var parentNode = danmuEl.parentNode;
    var video = parentNode.getElementsByTagName('video');
    if (video.length === 0) {
      return false;
    }
    return true;
  }
})(window);