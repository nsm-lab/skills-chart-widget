import { fetchData } from './shared/fetch-data';
import { renderChart } from './shared/render-chart';
import { renderError } from './shared/render-error';
import { renderLoading } from './shared/render-loading';
import { getChartData } from './shared/get-chart-data';
import { formatScore } from './shared/format-score';

// eslint-disable-next-line
const COMPONENT_TAG = 'codersrank-skills-chart';
const STATE_IDLE = 0;
const STATE_LOADING = 1;
const STATE_ERROR = 2;
const STATE_SUCCESS = 3;

// eslint-disable-next-line
const STYLES = `$_STYLES_$`;

const tempDiv = document.createElement('div');

// eslint-disable-next-line
class CodersRankSkillsChart extends HTMLElement {
  constructor() {
    super();

    this.shadowEl = this.attachShadow({ mode: 'closed' });

    this.stylesEl = document.createElement('style');
    this.stylesEl.textContent = STYLES;
    this.shadowEl.appendChild(this.stylesEl);
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onClick = this.onClick.bind(this);
    this.formatLabel = this.formatLabel.bind(this);
    this.onSVGMouseEnter = this.onSVGMouseEnter.bind(this);
    this.onSVGMouseMove = this.onSVGMouseMove.bind(this);
    this.onSVGMouseLeave = this.onSVGMouseLeave.bind(this);

    this.linesOffsets = [];
    this.currentIndex = null;
    this.hiddenDatasets = [];
    this.highlightedDatasetLabel = null;
    this.highlightedDatasetTimeout = null;

    this.maxLabels = 8;

    this.mounted = false;

    this.state = STATE_IDLE;

    this.data = {
      labels: [],
      datasets: [],
    };
  }

  static get observedAttributes() {
    return [
      'username',
      'svg-width',
      'svg-height',
      'legend',
      'labels',
      'skills',
      'show-other-skills',
    ];
  }

  get visibleLabels() {
    if (!this.maxLabels || this.data.labels.length <= this.maxLabels)
      return this.data.labels;
    const skipStep = Math.ceil(this.data.labels.length / this.maxLabels);
    const filtered = this.data.labels.filter((label, index) => index % skipStep === 0);
    return filtered;
  }

  // eslint-disable-next-line
  formatLabel(label) {
    if (!label) return '';
    const formatter = Intl.DateTimeFormat('en', { year: 'numeric', month: 'short' });
    return formatter.format(new Date(label));
  }

  get displaySkills() {
    const skills = this.getAttribute('skills') || '';
    if (typeof skills !== 'string') return [];
    return skills
      .split(',')
      .map((s) => s.trim())
      .filter((s) => !!s);
  }

  get showOtherSkills() {
    const showOtherSkills = this.getAttribute('show-other-skills');
    if (showOtherSkills === '' || showOtherSkills === 'true') return true;
    return false;
  }

  get tooltip() {
    const tooltip = this.getAttribute('tooltip');
    if (tooltip === '' || tooltip === 'true') return true;
    return false;
  }

  get username() {
    return this.getAttribute('username');
  }

  get svgWidth() {
    const svgWidth = parseInt(this.getAttribute('svg-width') || 0, 10);
    return svgWidth || 640;
  }

  get svgHeight() {
    const svgHeight = parseInt(this.getAttribute('svg-height') || 0, 10);
    return svgHeight || 320;
  }

  get legend() {
    const legend = this.getAttribute('legend');
    if (legend === '' || legend === 'true') return true;
    return false;
  }

  get labels() {
    const labels = this.getAttribute('labels');
    if (labels === '' || labels === 'true') return true;
    return false;
  }

  render() {
    const {
      username,
      mounted,
      state,
      shadowEl,
      data,
      svgWidth,
      svgHeight,
      legend,
      labels,

      hiddenDatasets,
      highlightedDatasetLabel,
      visibleLabels,
      currentIndex,
      formatLabel,
    } = this;
    const ctx = {
      data,
      svgWidth,
      svgHeight,
      legend,
      labels,

      hiddenDatasets,
      highlightedDatasetLabel,
      visibleLabels,
      currentIndex,
      formatLabel,
    };
    this.detachSVGEvents();

    if (!username || !mounted) return;
    if (state === STATE_SUCCESS) {
      tempDiv.innerHTML = renderChart(ctx);
    } else if (state === STATE_ERROR) {
      tempDiv.innerHTML = renderError(ctx);
    } else if (state === STATE_IDLE || state === STATE_LOADING) {
      tempDiv.innerHTML = renderLoading(ctx);
    }

    let widgetEl = shadowEl.querySelector('.codersrank-skills-chart');
    if (widgetEl) {
      widgetEl.parentNode.removeChild(widgetEl);
    }
    widgetEl = tempDiv.querySelector('.codersrank-skills-chart');
    if (!widgetEl) return;
    this.widgetEl = widgetEl;
    shadowEl.appendChild(widgetEl);
    this.attachSVGEvents();
  }

  loadAndRender() {
    const { username } = this;
    this.state = STATE_LOADING;
    this.render();
    fetchData(username)
      .then((data) => {
        this.data = getChartData(data.scores, this.displaySkills, this.showOtherSkills);
        this.state = STATE_SUCCESS;
        this.render();
      })
      .catch(() => {
        this.state = STATE_ERROR;
        this.render();
      });
  }

  tooltipText() {
    const currentIndex = this.currentIndex;
    const { datasets, labels } = this.data;
    if (currentIndex === null) return '';
    let total = 0;
    const currentValues = datasets
      .filter(
        (dataset) =>
          !this.hiddenDatasets.includes(dataset.label) && dataset.values[currentIndex],
      )
      .map((dataset) => ({
        color: dataset.color,
        label: dataset.label,
        value: dataset.values[currentIndex],
      }));
    currentValues.forEach((dataset) => {
      total += dataset.value;
    });

    const labelText = this.formatLabel(labels[currentIndex]);
    const totalText = `${formatScore(total)} exp. points`;
    // prettier-ignore
    const datasetsText = currentValues.length > 0 ? `
      <ul class="codersrank-skills-chart-tooltip-list">
        ${currentValues
          .map(({ label, color, value }) => {
            const valueText = `${label}: ${formatScore(value)}`;
            return `
              <li><span style="background-color: ${color};"></span>${valueText}</li>
            `;
          }).join('')}
      </ul>` : '';
    // prettier-ignore
    return `
        <div class="codersrank-skills-chart-tooltip-label">${labelText}</div>
        <div class="codersrank-skills-chart-tooltip-total">${totalText}</div>
        ${datasetsText}
      `;
  }

  showTooltip() {
    if (!this.tooltip) return;
    const visibleDataSets = this.data.datasets.filter(
      (dataset) => !this.hiddenDatasets.includes(dataset.label),
    ).length;
    if (!visibleDataSets) {
      this.hideTooltip();
      return;
    }

    const prevLineEl = this.shadowEl.querySelector(
      '.codersrank-skills-chart-current-line',
    );
    if (prevLineEl) prevLineEl.classList.remove('codersrank-skills-chart-current-line');

    const lineEl = this.shadowEl.querySelector(`line[data-index="${this.currentIndex}"]`);
    if (!lineEl) return;
    lineEl.classList.add('codersrank-skills-chart-current-line');

    let tooltipEl = this.widgetEl.querySelector('.codersrank-skills-chart-tooltip');
    if (!tooltipEl) {
      tempDiv.innerHTML = `
        <div class="codersrank-skills-chart-tooltip">
          ${this.tooltipText()}
        </div>
      `;
      tooltipEl = tempDiv.querySelector('.codersrank-skills-chart-tooltip');
      this.widgetEl.querySelector('.codersrank-skills-chart-svg').appendChild(tooltipEl);
    } else {
      tooltipEl.innerHTML = this.tooltipText();
    }

    const widgetElRect = this.widgetEl.getBoundingClientRect();
    const lineElRect = lineEl.getBoundingClientRect();
    const left = lineElRect.left - widgetElRect.left;
    if (left < 180) {
      tooltipEl.classList.add('codersrank-skills-chart-tooltip-right');
    } else {
      tooltipEl.classList.remove('codersrank-skills-chart-tooltip-right');
    }
    tooltipEl.style.left = `${left}px`;
  }

  hideTooltip() {
    if (!this.tooltip) return;
    const lineEl = this.shadowEl.querySelector('.codersrank-skills-chart-current-line');
    if (lineEl) lineEl.classList.remove('codersrank-skills-chart-current-line');
    const tooltipEl = this.shadowEl.querySelector('.codersrank-skills-chart-tooltip');
    if (!tooltipEl) return;
    this.widgetEl.querySelector('.codersrank-skills-chart-svg').removeChild(tooltipEl);
  }

  toggleDataset(label) {
    if (this.hiddenDatasets.includes(label)) {
      this.hiddenDatasets.splice(this.hiddenDatasets.indexOf(label), 1);
    } else {
      this.hiddenDatasets.push(label);
      this.highlightedDatasetLabel = null;
    }
    this.render();
  }

  onClick(e) {
    let buttonEl;
    if (e.target.tagName === 'BUTTON') buttonEl = e.target;
    else if (e.target.parentNode && e.target.parentNode.tagName === 'BUTTON')
      buttonEl = e.target.parentNode;
    if (!buttonEl) return;
    const label = buttonEl.getAttribute('data-label');
    this.toggleDataset(label);
  }

  onMouseEnter(e) {
    if (!this.widgetEl) return;
    let buttonEl;
    if (e.target.tagName === 'BUTTON') buttonEl = e.target;
    if (!buttonEl) return;
    const label = buttonEl.getAttribute('data-label');
    if (!label) return;
    this.highlightedDatasetLabel = label;
    const polygon = this.widgetEl.querySelector(`polygon[data-label="${label}"]`);
    if (!polygon) return;
    clearTimeout(this.highlightedDatasetTimeout);
    const polygons = this.widgetEl.querySelectorAll('polygon');
    for (let i = 0; i < polygons.length; i += 1) {
      polygons[i].classList.add('codersrank-skills-chart-hidden');
    }
    polygon.classList.remove('codersrank-skills-chart-hidden');
  }

  onMouseLeave(e) {
    if (e.target.tagName !== 'BUTTON') return;
    this.highlightedDatasetTimeout = setTimeout(() => {
      if (!this.widgetEl) return;
      const polygons = this.widgetEl.querySelectorAll('polygon');
      if (!polygons) return;
      for (let i = 0; i < polygons.length; i += 1) {
        polygons[i].classList.remove('codersrank-skills-chart-hidden');
      }
    }, 100);
  }

  calcLinesOffsets() {
    const lines = this.widgetEl.querySelectorAll('line');
    this.linesOffsets = [];
    for (let i = 0; i < lines.length; i += 1) {
      // @ts-ignore
      this.linesOffsets.push(lines[i].getBoundingClientRect().left);
    }
  }

  onSVGMouseEnter() {
    if (!this.tooltip) return;
    this.calcLinesOffsets();
  }

  onSVGMouseMove(e) {
    if (!this.tooltip) return;
    let currentLeft = e.pageX;
    if (typeof currentLeft === 'undefined') currentLeft = 0;
    const distances = this.linesOffsets.map((left) => Math.abs(currentLeft - left));
    const minDistance = Math.min(...distances);
    const closestIndex = distances.indexOf(minDistance);
    this.currentIndex = closestIndex;
    this.showTooltip();
  }

  onSVGMouseLeave() {
    if (!this.tooltip) return;
    this.currentIndex = null;
    this.hideTooltip();
  }

  attachSVGEvents() {
    if (!this.widgetEl) return;
    const svgEl = this.widgetEl.querySelector('svg');
    if (!svgEl) return;
    svgEl.addEventListener('mouseenter', this.onSVGMouseEnter);
    svgEl.addEventListener('mousemove', this.onSVGMouseMove);
    svgEl.addEventListener('mouseleave', this.onSVGMouseLeave);
  }

  detachSVGEvents() {
    if (!this.widgetEl) return;
    const svgEl = this.widgetEl.querySelector('svg');
    if (!svgEl) return;
    svgEl.removeEventListener('mouseenter', this.onSVGMouseEnter);
    svgEl.removeEventListener('mousemove', this.onSVGMouseMove);
    svgEl.removeEventListener('mouseleave', this.onSVGMouseLeave);
  }

  attributeChangedCallback() {
    if (!this.mounted) return;
    this.loadAndRender();
  }

  connectedCallback() {
    this.width = this.offsetWidth;
    this.mounted = true;
    this.loadAndRender();
    this.shadowEl.addEventListener('click', this.onClick, true);
    this.shadowEl.addEventListener('mouseenter', this.onMouseEnter, true);
    this.shadowEl.addEventListener('mouseleave', this.onMouseLeave, true);
  }

  disconnectedCallback() {
    this.mounted = false;
    this.shadowEl.removeEventListener('click', this.onClick);
    this.shadowEl.removeEventListener('mouseenter', this.onMouseEnter);
    this.shadowEl.removeEventListener('mouseleave', this.onMouseLeave);
    this.detachSVGEvents();
  }
}

// EXPORT
