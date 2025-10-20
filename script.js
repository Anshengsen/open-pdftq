document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const settingsPanel = document.getElementById('settingsPanel');
    const pagesGrid = document.getElementById('pagesGrid');
    const formatSelect = document.getElementById('formatSelect');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValue = document.getElementById('qualityValue');
    const scaleSlider = document.getElementById('scaleSlider');
    const scaleValue = document.getElementById('scaleValue');
    const convertBtn = document.getElementById('convertBtn');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    const clearBtn = document.getElementById('clearBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    let pdfDoc = null;
    let pageCanvases = new Map();
    let selectedPages = new Set();

    // 文件拖放处理
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // 处理上传的PDF文件
    async function handleFiles(files) {
        const file = files[0];
        if (!file || file.type !== 'application/pdf') {
            showMessage('请选择 PDF 文件', true);
            return;
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument(arrayBuffer);
            
            showMessage('正在加载 PDF...');
            pdfDoc = await loadingTask.promise;
            settingsPanel.hidden = false;
            dropZone.hidden = true;
            
            await renderAllPages();
        } catch (error) {
            console.error('Error:', error);
            showMessage('PDF 加载失败', true);
        }
    }

    // 渲染所有页面预览
    async function renderAllPages() {
        pagesGrid.innerHTML = '';
        pageCanvases.clear();
        selectedPages.clear();

        showMessage(`正在生成预览...`);
        
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const canvas = document.createElement('canvas');
            const scale = 0.5; // 预览缩略图比例
            const viewport = page.getViewport({ scale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: canvas.getContext('2d'),
                viewport: viewport
            }).promise;

            pageCanvases.set(pageNum, canvas);
            createPagePreview(pageNum, canvas);
        }

        showMessage(`共加载 ${pdfDoc.numPages} 页`);
    }

    // 创建页面预览元素
    function createPagePreview(pageNum, canvas) {
        const pageItem = document.createElement('div');
        pageItem.className = 'page-item';
        pageItem.innerHTML = `
            <img class="page-preview" src="${canvas.toDataURL()}" alt="Page ${pageNum}">
            <div class="page-number">第 ${pageNum} 页</div>
        `;

        pageItem.addEventListener('click', () => {
            pageItem.classList.toggle('selected');
            if (selectedPages.has(pageNum)) {
                selectedPages.delete(pageNum);
            } else {
                selectedPages.add(pageNum);
            }
            updateButtons();
        });

        pagesGrid.appendChild(pageItem);
    }

    // 更新按钮状态
    function updateButtons() {
        const hasSelection = selectedPages.size > 0;
        convertBtn.disabled = !hasSelection;
        downloadZipBtn.disabled = !hasSelection;
    }

    // 转换选中的页面
    async function convertSelectedPages() {
        if (selectedPages.size === 0) {
            showMessage('请选择要转换的页面', true);
            return;
        }

        const format = formatSelect.value;
        const quality = parseInt(qualitySlider.value) / 100;
        const scale = parseInt(scaleSlider.value) / 100;
        const total = selectedPages.size;
        let processed = 0;

        progressBar.hidden = false;
        convertBtn.disabled = true;
        downloadZipBtn.disabled = true;

        try {
            const zip = new JSZip();
            
            for (const pageNum of selectedPages) {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, `image/${format}`, quality);
                });

                zip.file(`page-${pageNum}.${format}`, blob);

                processed++;
                updateProgress(processed / total);
            }

            showMessage('正在创建压缩包...');
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pdf-images-${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);

            showMessage('转换完成！');
        } catch (error) {
            console.error('Conversion error:', error);
            showMessage('转换失败', true);
        } finally {
            progressBar.hidden = true;
            convertBtn.disabled = false;
            downloadZipBtn.disabled = false;
        }
    }

    // 更新进度条
    function updateProgress(percent) {
        const percentage = Math.round(percent * 100);
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
    }

    // 事件监听器
    selectAllBtn.addEventListener('click', () => {
        const pages = pagesGrid.querySelectorAll('.page-item');
        pages.forEach((page, index) => {
            page.classList.add('selected');
            selectedPages.add(index + 1);
        });
        updateButtons();
    });

    deselectAllBtn.addEventListener('click', () => {
        const pages = pagesGrid.querySelectorAll('.page-item');
        pages.forEach((page) => {
            page.classList.remove('selected');
        });
        selectedPages.clear();
        updateButtons();
    });

    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = `${qualitySlider.value}%`;
    });

    scaleSlider.addEventListener('input', () => {
        scaleValue.textContent = `${scaleSlider.value}%`;
    });

    convertBtn.addEventListener('click', convertSelectedPages);
    downloadZipBtn.addEventListener('click', convertSelectedPages);

    clearBtn.addEventListener('click', () => {
        pdfDoc = null;
        pageCanvases.clear();
        selectedPages.clear();
        settingsPanel.hidden = true;
        dropZone.hidden = false;
        pagesGrid.innerHTML = '';
        fileInput.value = '';
        progressBar.hidden = true;
    });

    // 显示消息提示
    function showMessage(text, isError = false) {
        const msg = document.createElement('div');
        msg.textContent = text;
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 8px;
            background: ${isError ? '#ef4444' : '#10b981'};
            color: white;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }
});