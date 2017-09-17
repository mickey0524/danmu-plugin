/**
 * 自制的H5弹幕播放插件
 * _开头的是private函数，在外部请不要调用
 * 没有_开头的是public函数，是Danmu插件暴露给使用者的函数，可以调用
 */

(function(window) {

  /**
   * [弹幕构造函数，用于初始化一个弹幕插件]
   * @param {string} className [类选择器，如果有重复的话，则取第一个]
   * @param {object} options   [弹幕插件的各种参数]
   */
  window.Danmu = function(className, options) {
    this._init(className, options);
    this._requestTrack();
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
    videoContainer.style.overflow = 'hidden';
    var parentPostiton = window.getComputedStyle(videoContainer).position;  //获取当前父亲容器的position
    if (parentPostiton == 'static') {
      videoContainer.style.position = 'relative';                           //需要的时候设置为relative，用于弹幕绝对布局的基准
    }
    var videoWidth = videoContainer.offsetWidth,
        videoHeight = videoContainer.offsetHeight;

    var trackHeight = (options && options.Height) || 24;
    var reminder = videoHeight % trackHeight;
    var trackNum = Math.floor(videoHeight / trackHeight);

    this.trackHeight = trackHeight; //轨道高度
    this.videoWidth = videoWidth; //轨道宽度
    this.trackList = [];  //轨道列表
    this.danmuList = [];  //弹幕列表
    this.el = danmuEl;    //弹幕DOM元素
    this.faskDanmu = (options && options.faskDanmu) || false;
    this.faskDanmuSpace = (options && options.faskDanmu) || 0;

    for (var i = 0; i < trackNum; i++) {
      if (i === trackNum - 1) {
        this.trackList.push(new Track(trackHeight + reminder));
      }
      else {
        this.trackList.push(new Track(trackHeight));
      }
    }
  };

  /**
   * [弹幕插件更新弹幕数据]
   * @param {Array[object]} [danmuList] [新插入弹幕插件的弹幕]
   */
  Danmu.prototype.updateDanmuList = function(danmuList) {
    if (Object.prototype.toString.call(danmuList) !== '[object Array]') {
      throw new Error('The danmu data format is wrong!');
    }
    danmuList.forEach(function(danmuItem) {
      danmuItem.isScroll = false;
      if (!danmuItem.speed) {
        danmuItem.speed = getRandomSpeed(this.videoWidth);
      }
      if (!danmuItem.size) {
        danmuItem.size = Math.floor(Math.random() * 24) + 18;
      }
    }.bind(this));
    this.danmuList = this.danmuList.concat(danmuList);
  };

  /**
   * [是否开始弹幕追击插入模式，关闭该模式的轨道弹幕速度有限制，后面插入的弹幕速度必须小于前面的，这样容易有很多留白]
   * @param {boolean} faskDanmu [flag为true，则开启，反之，则关闭]
   * @param {number} faskDanmuSpace [弹幕之间的最小间距，可选的参数]
   */
  Danmu.prototype.openFaskDanmu = function(faskDanmu, faskDanmuSpace) {
    this.faskDanmu = faskDanmu;
    if (faskDanmuSpace) {
      this.faskDanmuSpace = faskDanmuSpace;
    }
  };

  /**
   * [弹幕列表中的弹幕定时请求轨道]
   * @return {[type]} [description]
   */
  Danmu.prototype._requestTrack = function() {
    this.reqTrackTimer = setInterval(function() { //弹幕列表定时请求轨道是否能够插入
      for (var i = 0; i < this.danmuList.length; i++) {
        if (this.danmuList[i].isScroll) {
          continue; //弹幕已经在轨道中滚动
        }
        for (var j = 0; j < this.trackList.length; j++) {
          if (this.trackList[j].isExistWaitDanmu || //还有未完全进入video视口的弹幕，轨道不能用
             (this.trackList[j].thresholdV < this.danmuList[i].speed &&
             (!this.faskDanmu || !compareSpeed(this.trackList[j], this.danmuList[i], this.videoWidth)))) {
            continue;
          }
          if (this.danmuList[i].size > this.trackList[j].trackHeight) { //需要拼接轨道
            if (j == this.trackList.length - 1) {
              continue; //没有可以拼接的轨道
            }
            else {
              var danmuSize = this.danmuList[i].size;
              var curTrackHeight = this.trackList[j].trackHeight;
              var curIndex = j + 1;
              var trackfound = false;
              while (curIndex < this.trackList.length) {
                if (this.trackList[curIndex].isExistWaitDanmu ||
                   (this.trackList[curIndex].thresholdV < this.danmuList[i].speed &&
                   (!this.faskDanmu || !compareSpeed(this.trackList[curIndex], this.danmuList[i], this.videoWidth)))) {
                  j = curIndex;
                  break;
                }
                curTrackHeight += this.trackList[curIndex].trackHeight;
                if (curTrackHeight > danmuSize) { //存在多个轨道拼接能够容纳该弹幕
                  for (var beginIndex = j; beginIndex <= curIndex; beginIndex++) {
                    this.trackList[beginIndex].isExistWaitDanmu = true;
                    this.trackList[beginIndex].thresholdV = this.danmuList[i].speed;
                    this.trackList[beginIndex].danmuNum += 1;
                  }
                  this.danmuList[i].isScroll = true;
                  this._danmuInsert(i, j, curIndex);
                  i -= 1; //_danmuAnimate函数中删除了节点，不剪一会遗漏循环项
                  trackfound = true;
                  break;
                }
                curIndex += 1;
              }
              if (trackfound) {
                break;
              }
            }
          }
          else {
            this.trackList[j].isExistWaitDanmu = true;
            this.trackList[j].thresholdV = this.danmuList[i].speed;
            this.trackList[j].danmuNum += 1;
            this.danmuList[i].isScroll = true;
            this._danmuInsert(i, j, j);
            i -= 1; //_danmuAnimate函数中删除了节点，不剪一会遗漏循环项
            break;
          }
        }
      }
    }.bind(this), 200);
  };

  /**
   * [弹幕请求到了能够承接的轨道，开始在video上进行滚屏]
   * @param {number} [danmuIndex] [滚动的弹幕index]
   * @param {number} [beginIndex] [起始的轨道index]
   * @param {number} [endIndex] [结束的轨道index]
   */
  Danmu.prototype._danmuInsert = function(danmuIndex, beginIndex, endIndex) {
    var danmuSize = this.danmuList[danmuIndex].size;
    var danmuColor = this.danmuList[danmuIndex].color || getRandomColor();
    var danmuContent = this.danmuList[danmuIndex].content || '弹幕啊';

    var HeightSum = 0;
    for (var i = beginIndex; i <= endIndex; i++) {
      HeightSum += this.trackList[i].trackHeight;
    }
    var offsetTop = beginIndex * this.trackHeight + (HeightSum - danmuSize) / 2;
    var offsetLeft = this.videoWidth;
    var danmuNode = document.createElement('span');
    danmuNode.className = 'danmu-node';
    danmuNode.innerHTML = danmuContent;
    danmuNode.style.cssText = 'position: absolute; display: inline-block; color: ' + danmuColor +
                              '; font-size: ' + (danmuSize) + 'px; line-height: ' + danmuSize + 'px; top: ' + offsetTop +
                              'px; transform: translateX(' + offsetLeft + 'px);';
    this.el.appendChild(danmuNode);
    for (var i = beginIndex; i <= endIndex; i++) {
      this.trackList[i].lastScrollDanmu = danmuNode;
    }
    this._danmuAnimate(danmuIndex, danmuNode, beginIndex, endIndex);
  };

  /**
   * [一条弹幕在video中滚动的动画]
   * @param {number} [danmuIndex] [滚动的弹幕index]
   * @param {element} [danmuNode] [滚动的弹幕节点]
   * @param {number} [beginIndex] [起始的轨道index]
   * @param {number} [endIndex] [结束的轨道index]
   */
  Danmu.prototype._danmuAnimate = function(danmuIndex, danmuNode, beginIndex, endIndex) {
    var danmuWidth = danmuNode.offsetWidth;
    var danmuSpeed = this.danmuList[danmuIndex].speed; //弹幕的速度定义是1s移动多少px
    var frameDistance = danmuSpeed / 60; // 1s requestAnimationFrame渲染60次
    var changeNoWait = true;
    var _this = this;
    this.danmuList.splice(danmuIndex, 1); //弹幕插入完毕，删除节点
    function step() {
      var curOffset = danmuNode.style.transform.replace(/[^0-9|\-|\.]/g, '');
      var newOffset = curOffset - frameDistance;
      danmuNode.style.transform = 'translateX(' + newOffset + 'px)';
      if (newOffset > -danmuWidth) {
        if (changeNoWait && (newOffset < _this.videoWidth - danmuWidth)) {
          for (var i = beginIndex; i <= endIndex; i++) {
            _this.trackList[i].isExistWaitDanmu = false;
          }
          changeNoWait = false;
        }
        requestAnimationFrame(step);
      }
      else {
        danmuNode.parentNode.removeChild(danmuNode); //从DOM中删除该弹幕节点
        for (var i = beginIndex; i <= endIndex; i++) {
          _this.trackList[i].danmuNum -= 1;
          if (_this.trackList[i].danmuNum === 0) {
            _this.trackList[i].thresholdV = Number.MAX_SAFE_INTEGER;
          }
        }
      }
    }
    requestAnimationFrame(step);
  };

  /**
   * [开启弹幕追击模式的时候，调用该函数判断当前弹幕是否能够插入，其实就是一个追击问题]
   * @param {Class(Track)} [track] [轨道]
   * @param {object} [danmu] [弹幕]
   * @param {number} [videoWidth] [video的宽度]
   * @return {boolean} [如果弹幕不会碰撞，允许插入的时候，返回true，否则返回false]
   */
  function compareSpeed(track, danmu, videoWidth) {
    if (!track.lastScrollDanmu) {
      return true;
    }
    var targetNode = track.lastScrollDanmu;  //需要追击的节点
    var targetOffset = targetNode.style.transform.replace(/[^0-9|\-|\.]/g, '');
    var targetTime = (Number(targetNode.offsetWidth) + Number(targetOffset)) / track.thresholdV;
    var chaserTime = (videoWidth - this.faskDanmuSpace) / danmu.speed;
    if (chaserTime >= targetTime) {
      return true;
    }
    return false;
  }

  /**
   * [轨道构造函数，将播放器按高度进行分割，形成一个一个轨道]
   * @param {number} [trackHeight] [轨道的高度]
   */
  function Track(trackHeight) {
    this.trackHeight = trackHeight;              // 轨道的高度
    this.thresholdV = Number.MAX_SAFE_INTEGER;   // 轨道当前的弹幕限制速度
    this.isExistWaitDanmu = false;               // 轨道是否存在还未完全进入video视口的弹幕
    this.danmuNum = 0;                           // 轨道中滚动弹幕个数
    this.lastScrollDanmu = null;                 // 最后添加进轨道的弹幕元素，用于追击插入弹幕的时候使用
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

  /**
   * [随机获取一种颜色]
   * @return {string} [弹幕的颜色]
   */
  function getRandomColor() {
    var redRatio = Math.floor(Math.random() * 256),
        greenRatio = Math.floor(Math.random() * 256),
        blueRatio = Math.floor(Math.random() * 256);
    return 'rgb(' + redRatio + ', ' + greenRatio + ', ' + blueRatio + ')';
  }

  /**
   * [随机获取弹幕滚动的速度]
   * @param {number} [videoWidth] [video的宽度]
   * @return {number} [弹幕滚动的速度]
   */
  function getRandomSpeed(videoWidth) {
    var MIN_SPEED = videoWidth / 10;
    var speed = Math.ceil(Math.random() * videoWidth / 2);
    return Math.max(speed, MIN_SPEED);
  }
})(window);