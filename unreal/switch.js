function clickSwitch() {
              'use strict';
              var isA = 0; // 現在地判定
              var btnA = document.getElementById('a');
              var btnB = document.getElementById('b');
              var divA = document.getElementById('divA');
              var divB = document.getElementById('divB');

              function setState(isA) {
                btnA.className = (isA == 0) ? 'btn inactive' : 'btn'; // Aのとき非表示
                divA.className = (isA == 0) ? 'boxDisplay' : 'boxNone'; // Aのとき表示
                btnB.className = (isA == 1) ? 'btn inactive' : 'btn'; // Bのとき非表示
                divB.className = (isA == 1) ? 'boxDisplay' : 'boxNone'; // Bのとき表示
              }
              setState(0);

              btnA.addEventListener('click', function(){
                if (isA == 0) return;
                isA = 0;
                setState(0);
              });
              btnB.addEventListener('click', function(){
                if (isA == 1) return;
                isA = 1;
                setState(1);
              });
            };
            document.addEventListener("DOMContentLoaded", clickSwitch, false);