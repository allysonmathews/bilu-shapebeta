import React, { useState, useCallback, useEffect } from 'react';
import type { MuscleGroup, JointGroup } from '../data/mockDatabase';

export type Severity = 'low' | 'medium' | 'high';

export interface Injury {
  id: string;
  type: 'muscle' | 'joint';
  severity: Severity;
}

interface InjuryMapProps {
  onChange?: (injuries: Injury[]) => void;
  initialInjuries?: Injury[];
}

// Mapeamento de grupos musculares para paths SVG
interface MuscleArea {
  id: string;
  muscleGroup: MuscleGroup;
  view: 'front' | 'back';
  path: string;
  label: string;
}

// Mapeamento de articulações para posições SVG
interface JointMarker {
  id: string;
  jointGroup: JointGroup;
  view: 'front' | 'back' | 'both';
  cx: number;
  cy: number;
  label: string;
}

const muscleAreas: MuscleArea[] = [
  // Vista frontal
  { id: 'chest-front', muscleGroup: 'chest', view: 'front', path: 'M 140 90 Q 175 85 210 90 L 210 130 Q 175 135 140 130 Z', label: 'Peito' },
  { id: 'shoulders-front-left', muscleGroup: 'shoulders', view: 'front', path: 'M 110 85 Q 140 80 140 90 L 140 110 Q 110 105 110 95 Z', label: 'Ombros' },
  { id: 'shoulders-front-right', muscleGroup: 'shoulders', view: 'front', path: 'M 210 90 Q 240 85 240 95 L 240 105 Q 210 110 210 90 Z', label: 'Ombros' },
  { id: 'biceps-front-left', muscleGroup: 'biceps', view: 'front', path: 'M 90 110 Q 110 105 110 115 L 110 150 Q 90 155 90 145 Z', label: 'Bíceps' },
  { id: 'biceps-front-right', muscleGroup: 'biceps', view: 'front', path: 'M 240 115 Q 260 110 260 120 L 260 150 Q 240 155 240 145 Z', label: 'Bíceps' },
  { id: 'triceps-front-left', muscleGroup: 'triceps', view: 'front', path: 'M 90 150 Q 110 145 110 155 L 110 190 Q 90 195 90 185 Z', label: 'Tríceps' },
  { id: 'triceps-front-right', muscleGroup: 'triceps', view: 'front', path: 'M 240 155 Q 260 150 260 160 L 260 190 Q 240 195 240 185 Z', label: 'Tríceps' },
  { id: 'forearms-front-left', muscleGroup: 'forearms', view: 'front', path: 'M 90 190 Q 110 185 110 195 L 110 220 Q 90 225 90 215 Z', label: 'Antebraço' },
  { id: 'forearms-front-right', muscleGroup: 'forearms', view: 'front', path: 'M 240 195 Q 260 190 260 200 L 260 220 Q 240 225 240 215 Z', label: 'Antebraço' },
  { id: 'abs-front', muscleGroup: 'abs', view: 'front', path: 'M 140 130 Q 175 135 210 130 L 210 195 Q 175 200 140 195 Z', label: 'Abdômen' },
  { id: 'quads-front-left', muscleGroup: 'quads', view: 'front', path: 'M 150 195 Q 165 200 165 210 L 165 280 Q 150 285 150 275 Z', label: 'Quadríceps' },
  { id: 'quads-front-right', muscleGroup: 'quads', view: 'front', path: 'M 185 195 Q 200 200 200 210 L 200 280 Q 185 285 185 275 Z', label: 'Quadríceps' },
  { id: 'calves-front-left', muscleGroup: 'calves', view: 'front', path: 'M 150 280 Q 165 285 165 295 L 165 330 Q 150 335 150 325 Z', label: 'Panturrilhas' },
  { id: 'calves-front-right', muscleGroup: 'calves', view: 'front', path: 'M 185 295 Q 200 290 200 300 L 200 330 Q 185 335 185 325 Z', label: 'Panturrilhas' },
  
  // Vista traseira
  { id: 'back-back', muscleGroup: 'back', view: 'back', path: 'M 140 85 Q 175 80 210 85 L 210 195 Q 175 200 140 195 Z', label: 'Costas' },
  { id: 'shoulders-back-left', muscleGroup: 'shoulders', view: 'back', path: 'M 110 80 Q 140 75 140 85 L 140 105 Q 110 100 110 90 Z', label: 'Ombros' },
  { id: 'shoulders-back-right', muscleGroup: 'shoulders', view: 'back', path: 'M 210 85 Q 240 80 240 90 L 240 100 Q 210 105 210 85 Z', label: 'Ombros' },
  { id: 'triceps-back-left', muscleGroup: 'triceps', view: 'back', path: 'M 90 105 Q 110 100 110 110 L 110 150 Q 90 155 90 145 Z', label: 'Tríceps' },
  { id: 'triceps-back-right', muscleGroup: 'triceps', view: 'back', path: 'M 240 110 Q 260 105 260 115 L 260 150 Q 240 155 240 145 Z', label: 'Tríceps' },
  { id: 'biceps-back-left', muscleGroup: 'biceps', view: 'back', path: 'M 90 150 Q 110 145 110 155 L 110 185 Q 90 190 90 180 Z', label: 'Bíceps' },
  { id: 'biceps-back-right', muscleGroup: 'biceps', view: 'back', path: 'M 240 155 Q 260 150 260 160 L 260 185 Q 240 190 240 180 Z', label: 'Bíceps' },
  { id: 'forearms-back-left', muscleGroup: 'forearms', view: 'back', path: 'M 90 185 Q 110 180 110 190 L 110 220 Q 90 225 90 215 Z', label: 'Antebraço' },
  { id: 'forearms-back-right', muscleGroup: 'forearms', view: 'back', path: 'M 240 190 Q 260 185 260 195 L 260 220 Q 240 225 240 215 Z', label: 'Antebraço' },
  { id: 'lower_back-back', muscleGroup: 'lower_back', view: 'back', path: 'M 140 130 Q 175 135 210 130 L 210 195 Q 175 200 140 195 Z', label: 'Lombar' },
  { id: 'glutes-back-left', muscleGroup: 'glutes', view: 'back', path: 'M 150 195 Q 165 200 165 210 L 165 240 Q 150 245 150 235 Z', label: 'Glúteos' },
  { id: 'glutes-back-right', muscleGroup: 'glutes', view: 'back', path: 'M 185 195 Q 200 200 200 210 L 200 240 Q 185 245 185 235 Z', label: 'Glúteos' },
  { id: 'hamstrings-back-left', muscleGroup: 'hamstrings', view: 'back', path: 'M 150 240 Q 165 245 165 255 L 165 330 Q 150 335 150 325 Z', label: 'Posterior' },
  { id: 'hamstrings-back-right', muscleGroup: 'hamstrings', view: 'back', path: 'M 185 255 Q 200 250 200 260 L 200 330 Q 185 335 185 325 Z', label: 'Posterior' },
  { id: 'calves-back-left', muscleGroup: 'calves', view: 'back', path: 'M 150 280 Q 165 285 165 295 L 165 330 Q 150 335 150 325 Z', label: 'Panturrilhas' },
  { id: 'calves-back-right', muscleGroup: 'calves', view: 'back', path: 'M 185 295 Q 200 290 200 300 L 200 330 Q 185 335 185 325 Z', label: 'Panturrilhas' },
];

const jointMarkers: JointMarker[] = [
  // Vista frontal
  { id: 'shoulder-front-left', jointGroup: 'shoulder_joint', view: 'front', cx: 110, cy: 100, label: 'Ombro' },
  { id: 'shoulder-front-right', jointGroup: 'shoulder_joint', view: 'front', cx: 240, cy: 100, label: 'Ombro' },
  { id: 'elbow-front-left', jointGroup: 'elbow', view: 'front', cx: 110, cy: 150, label: 'Cotovelo' },
  { id: 'elbow-front-right', jointGroup: 'elbow', view: 'front', cx: 240, cy: 150, label: 'Cotovelo' },
  { id: 'wrist-front-left', jointGroup: 'wrist', view: 'front', cx: 110, cy: 210, label: 'Punho' },
  { id: 'wrist-front-right', jointGroup: 'wrist', view: 'front', cx: 240, cy: 210, label: 'Punho' },
  { id: 'hip-front-left', jointGroup: 'hip', view: 'front', cx: 160, cy: 195, label: 'Quadril' },
  { id: 'hip-front-right', jointGroup: 'hip', view: 'front', cx: 190, cy: 195, label: 'Quadril' },
  { id: 'knee-front-left', jointGroup: 'knee', view: 'front', cx: 165, cy: 280, label: 'Joelho' },
  { id: 'knee-front-right', jointGroup: 'knee', view: 'front', cx: 200, cy: 280, label: 'Joelho' },
  { id: 'ankle-front-left', jointGroup: 'ankle', view: 'front', cx: 165, cy: 330, label: 'Tornozelo' },
  { id: 'ankle-front-right', jointGroup: 'ankle', view: 'front', cx: 200, cy: 330, label: 'Tornozelo' },
  { id: 'spine-front', jointGroup: 'spine', view: 'front', cx: 175, cy: 160, label: 'Coluna' },
  
  // Vista traseira
  { id: 'shoulder-back-left', jointGroup: 'shoulder_joint', view: 'back', cx: 110, cy: 95, label: 'Ombro' },
  { id: 'shoulder-back-right', jointGroup: 'shoulder_joint', view: 'back', cx: 240, cy: 95, label: 'Ombro' },
  { id: 'elbow-back-left', jointGroup: 'elbow', view: 'back', cx: 110, cy: 145, label: 'Cotovelo' },
  { id: 'elbow-back-right', jointGroup: 'elbow', view: 'back', cx: 240, cy: 145, label: 'Cotovelo' },
  { id: 'wrist-back-left', jointGroup: 'wrist', view: 'back', cx: 110, cy: 210, label: 'Punho' },
  { id: 'wrist-back-right', jointGroup: 'wrist', view: 'back', cx: 240, cy: 210, label: 'Punho' },
  { id: 'hip-back-left', jointGroup: 'hip', view: 'back', cx: 160, cy: 195, label: 'Quadril' },
  { id: 'hip-back-right', jointGroup: 'hip', view: 'back', cx: 190, cy: 195, label: 'Quadril' },
  { id: 'knee-back-left', jointGroup: 'knee', view: 'back', cx: 165, cy: 280, label: 'Joelho' },
  { id: 'knee-back-right', jointGroup: 'knee', view: 'back', cx: 200, cy: 280, label: 'Joelho' },
  { id: 'ankle-back-left', jointGroup: 'ankle', view: 'back', cx: 165, cy: 330, label: 'Tornozelo' },
  { id: 'ankle-back-right', jointGroup: 'ankle', view: 'back', cx: 200, cy: 330, label: 'Tornozelo' },
  { id: 'spine-back', jointGroup: 'spine', view: 'back', cx: 175, cy: 160, label: 'Coluna' },
  { id: 'scapula-back-left', jointGroup: 'scapula', view: 'back', cx: 130, cy: 120, label: 'Escápula' },
  { id: 'scapula-back-right', jointGroup: 'scapula', view: 'back', cx: 220, cy: 120, label: 'Escápula' },
];

// Silhueta humana SVG - Vista frontal
const FrontSilhouette: React.FC<{
  selectedItems: Map<string, { type: 'muscle' | 'joint'; severity: Severity }>;
  onAreaClick: (areaId: string, muscleGroup: MuscleGroup, label: string) => void;
  onJointClick: (jointId: string, jointGroup: JointGroup, label: string) => void;
  activeSeveritySelector: { id: string; type: 'muscle' | 'joint'; name: string } | null;
  onSeveritySelect: (id: string, type: 'muscle' | 'joint', severity: Severity) => void;
  onSeverityClose: () => void;
}> = ({ selectedItems, onAreaClick, onJointClick, activeSeveritySelector, onSeveritySelect, onSeverityClose }) => {
  const frontAreas = muscleAreas.filter(area => area.view === 'front');
  const frontJoints = jointMarkers.filter(joint => joint.view === 'front');

  const getMuscleFillColor = (areaId: string) => {
    const injury = selectedItems.get(areaId);
    if (!injury || injury.type !== 'muscle') return 'transparent';
    const severity = injury.severity;
    if (severity === 'high') return '#EF4444';
    if (severity === 'medium') return '#F59E0B';
    return '#10B981';
  };

  const getMuscleGlow = (areaId: string) => {
    const injury = selectedItems.get(areaId);
    if (injury && injury.type === 'muscle') {
      return {
        filter: 'drop-shadow(0 0 8px #39FF14) drop-shadow(0 0 12px #39FF14)',
        stroke: '#39FF14',
        strokeWidth: 3,
      };
    }
    return {
      filter: 'none',
      stroke: '#374151',
      strokeWidth: 1,
    };
  };

  const getJointGlow = (jointId: string) => {
    const injury = selectedItems.get(jointId);
    if (injury && injury.type === 'joint') {
      return {
        filter: 'drop-shadow(0 0 6px #39FF14) drop-shadow(0 0 10px #39FF14)',
        fill: '#39FF14',
        stroke: '#39FF14',
      };
    }
    return {
      filter: 'none',
      fill: '#6B7280',
      stroke: '#374151',
    };
  };

  return (
    <div className="relative">
      <svg
        viewBox="0 0 350 360"
        className="w-full h-auto"
        style={{ maxHeight: '400px' }}
      >
        {/* Cabeça */}
        <ellipse cx="175" cy="45" rx="28" ry="32" fill="#1F2937" stroke="#374151" strokeWidth="2" />
        
        {/* Pescoço */}
        <rect x="165" y="75" width="20" height="15" fill="#1F2937" stroke="#374151" strokeWidth="2" rx="3" />
        
        {/* Tronco */}
        <path
          d="M 130 90 Q 175 85 220 90 L 220 195 Q 175 200 130 195 Z"
          fill="#1F2937"
          stroke="#374151"
          strokeWidth="2"
        />
        
        {/* Braços - esquerdo */}
        <path
          d="M 90 110 Q 110 105 110 115 L 110 190 Q 90 195 90 185 Z"
          fill="#1F2937"
          stroke="#374151"
          strokeWidth="2"
        />
        
        {/* Braços - direito */}
        <path
          d="M 240 115 Q 260 110 260 120 L 260 190 Q 240 195 240 185 Z"
          fill="#1F2937"
          stroke="#374151"
          strokeWidth="2"
        />
        
        {/* Pernas */}
        <path
          d="M 150 195 Q 165 200 165 210 L 165 330 Q 150 335 150 325 Z"
          fill="#1F2937"
          stroke="#374151"
          strokeWidth="2"
        />
        <path
          d="M 185 195 Q 200 200 200 210 L 200 330 Q 185 335 185 325 Z"
          fill="#1F2937"
          stroke="#374151"
          strokeWidth="2"
        />
        
        {/* Áreas musculares clicáveis */}
        {frontAreas.map((area) => {
          const glow = getMuscleGlow(area.id);
          const fillColor = getMuscleFillColor(area.id);
          const isSelected = selectedItems.has(area.id);
          
          return (
            <path
              key={area.id}
              d={area.path}
              fill={fillColor}
              fillOpacity={isSelected ? 0.6 : 0}
              stroke={glow.stroke}
              strokeWidth={glow.strokeWidth}
              style={{
                filter: glow.filter,
                cursor: 'pointer',
                transition: 'all 0.2s',
                pointerEvents: 'all',
              }}
              className="hover:fill-opacity-30 touch-manipulation"
              onClick={() => onAreaClick(area.id, area.muscleGroup, area.label)}
              onTouchStart={(e) => {
                e.preventDefault();
                onAreaClick(area.id, area.muscleGroup, area.label);
              }}
            />
          );
        })}
        
        {/* Marcadores de articulações clicáveis */}
        {frontJoints.map((joint) => {
          const glow = getJointGlow(joint.id);
          const isSelected = selectedItems.has(joint.id);
          
          return (
            <circle
              key={joint.id}
              cx={joint.cx}
              cy={joint.cy}
              r={isSelected ? 8 : 6}
              fill={glow.fill}
              stroke={glow.stroke}
              strokeWidth={isSelected ? 2 : 1}
              style={{
                filter: glow.filter,
                cursor: 'pointer',
                transition: 'all 0.2s',
                pointerEvents: 'all',
              }}
              className="touch-manipulation"
              onClick={() => onJointClick(joint.id, joint.jointGroup, joint.label)}
              onTouchStart={(e) => {
                e.preventDefault();
                onJointClick(joint.id, joint.jointGroup, joint.label);
              }}
            />
          );
        })}
      </svg>
      
      {/* Overlay para fechar seletor de severidade */}
      {activeSeveritySelector && (
        <div
          className="absolute inset-0 bg-black/30 z-[5]"
          onClick={onSeverityClose}
        />
      )}
      
      {/* Popup de severidade */}
      {activeSeveritySelector && (
        <div
          className="absolute bg-card-bg border-2 border-alien-green rounded-lg p-4 shadow-lg z-10 touch-manipulation"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            minWidth: '220px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-alien-green font-semibold text-base">
              Lesão no {activeSeveritySelector.name}
            </span>
            <button
              onClick={onSeverityClose}
              className="text-gray-400 hover:text-white transition-colors text-lg"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as Severity[]).map((severity) => {
              const colors = {
                low: 'bg-emerald-500 hover:bg-emerald-600',
                medium: 'bg-amber-500 hover:bg-amber-600',
                high: 'bg-red-500 hover:bg-red-600',
              };
              return (
                <button
                  key={severity}
                  onClick={() => {
                    onSeveritySelect(activeSeveritySelector.id, activeSeveritySelector.type, severity);
                    onSeverityClose();
                  }}
                  className={`${colors[severity]} text-white px-4 py-2 rounded text-sm font-medium transition-colors capitalize flex-1`}
                >
                  {severity === 'low' ? 'Baixa' : severity === 'medium' ? 'Média' : 'Alta'}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Silhueta humana SVG - Vista traseira
const BackSilhouette: React.FC<{
  selectedItems: Map<string, { type: 'muscle' | 'joint'; severity: Severity }>;
  onAreaClick: (areaId: string, muscleGroup: MuscleGroup, label: string) => void;
  onJointClick: (jointId: string, jointGroup: JointGroup, label: string) => void;
  activeSeveritySelector: { id: string; type: 'muscle' | 'joint'; name: string } | null;
  onSeveritySelect: (id: string, type: 'muscle' | 'joint', severity: Severity) => void;
  onSeverityClose: () => void;
}> = ({ selectedItems, onAreaClick, onJointClick, activeSeveritySelector, onSeveritySelect, onSeverityClose }) => {
  const backAreas = muscleAreas.filter(area => area.view === 'back');
  const backJoints = jointMarkers.filter(joint => joint.view === 'back');

  const getMuscleFillColor = (areaId: string) => {
    const injury = selectedItems.get(areaId);
    if (!injury || injury.type !== 'muscle') return 'transparent';
    const severity = injury.severity;
    if (severity === 'high') return '#EF4444';
    if (severity === 'medium') return '#F59E0B';
    return '#10B981';
  };

  const getMuscleGlow = (areaId: string) => {
    const injury = selectedItems.get(areaId);
    if (injury && injury.type === 'muscle') {
      return {
        filter: 'drop-shadow(0 0 8px #39FF14) drop-shadow(0 0 12px #39FF14)',
        stroke: '#39FF14',
        strokeWidth: 3,
      };
    }
    return {
      filter: 'none',
      stroke: '#374151',
      strokeWidth: 1,
    };
  };

  const getJointGlow = (jointId: string) => {
    const injury = selectedItems.get(jointId);
    if (injury && injury.type === 'joint') {
      return {
        filter: 'drop-shadow(0 0 6px #39FF14) drop-shadow(0 0 10px #39FF14)',
        fill: '#39FF14',
        stroke: '#39FF14',
      };
    }
    return {
      filter: 'none',
      fill: '#6B7280',
      stroke: '#374151',
    };
  };

  return (
    <div className="relative">
      <svg
        viewBox="0 0 350 360"
        className="w-full h-auto"
        style={{ maxHeight: '400px' }}
      >
        {/* Cabeça */}
        <ellipse cx="175" cy="45" rx="28" ry="32" fill="#1F2937" stroke="#374151" strokeWidth="2" />
        
        {/* Pescoço */}
        <rect x="165" y="75" width="20" height="15" fill="#1F2937" stroke="#374151" strokeWidth="2" rx="3" />
        
        {/* Tronco */}
        <path
          d="M 130 85 Q 175 80 220 85 L 220 195 Q 175 200 130 195 Z"
          fill="#1F2937"
          stroke="#374151"
          strokeWidth="2"
        />
        
        {/* Braços - esquerdo */}
        <path
          d="M 90 105 Q 110 100 110 110 L 110 185 Q 90 190 90 180 Z"
          fill="#1F2937"
          stroke="#374151"
          strokeWidth="2"
        />
        
        {/* Braços - direito */}
        <path
          d="M 240 110 Q 260 105 260 115 L 260 185 Q 240 190 240 180 Z"
          fill="#1F2937"
          stroke="#374151"
          strokeWidth="2"
        />
        
        {/* Pernas */}
        <path
          d="M 150 195 Q 165 200 165 210 L 165 330 Q 150 335 150 325 Z"
          fill="#1F2937"
          stroke="#374151"
          strokeWidth="2"
        />
        <path
          d="M 185 195 Q 200 200 200 210 L 200 330 Q 185 335 185 325 Z"
          fill="#1F2937"
          stroke="#374151"
          strokeWidth="2"
        />
        
        {/* Áreas musculares clicáveis */}
        {backAreas.map((area) => {
          const glow = getMuscleGlow(area.id);
          const fillColor = getMuscleFillColor(area.id);
          const isSelected = selectedItems.has(area.id);
          
          return (
            <path
              key={area.id}
              d={area.path}
              fill={fillColor}
              fillOpacity={isSelected ? 0.6 : 0}
              stroke={glow.stroke}
              strokeWidth={glow.strokeWidth}
              style={{
                filter: glow.filter,
                cursor: 'pointer',
                transition: 'all 0.2s',
                pointerEvents: 'all',
              }}
              className="hover:fill-opacity-30 touch-manipulation"
              onClick={() => onAreaClick(area.id, area.muscleGroup, area.label)}
              onTouchStart={(e) => {
                e.preventDefault();
                onAreaClick(area.id, area.muscleGroup, area.label);
              }}
            />
          );
        })}
        
        {/* Marcadores de articulações clicáveis */}
        {backJoints.map((joint) => {
          const glow = getJointGlow(joint.id);
          const isSelected = selectedItems.has(joint.id);
          
          return (
            <circle
              key={joint.id}
              cx={joint.cx}
              cy={joint.cy}
              r={isSelected ? 8 : 6}
              fill={glow.fill}
              stroke={glow.stroke}
              strokeWidth={isSelected ? 2 : 1}
              style={{
                filter: glow.filter,
                cursor: 'pointer',
                transition: 'all 0.2s',
                pointerEvents: 'all',
              }}
              className="touch-manipulation"
              onClick={() => onJointClick(joint.id, joint.jointGroup, joint.label)}
              onTouchStart={(e) => {
                e.preventDefault();
                onJointClick(joint.id, joint.jointGroup, joint.label);
              }}
            />
          );
        })}
      </svg>
      
      {/* Overlay para fechar seletor de severidade */}
      {activeSeveritySelector && (
        <div
          className="absolute inset-0 bg-black/30 z-[5]"
          onClick={onSeverityClose}
        />
      )}
      
      {/* Popup de severidade */}
      {activeSeveritySelector && (
        <div
          className="absolute bg-card-bg border-2 border-alien-green rounded-lg p-4 shadow-lg z-10 touch-manipulation"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            minWidth: '220px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-alien-green font-semibold text-base">
              Lesão no {activeSeveritySelector.name}
            </span>
            <button
              onClick={onSeverityClose}
              className="text-gray-400 hover:text-white transition-colors text-lg"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as Severity[]).map((severity) => {
              const colors = {
                low: 'bg-emerald-500 hover:bg-emerald-600',
                medium: 'bg-amber-500 hover:bg-amber-600',
                high: 'bg-red-500 hover:bg-red-600',
              };
              return (
                <button
                  key={severity}
                  onClick={() => {
                    onSeveritySelect(activeSeveritySelector.id, activeSeveritySelector.type, severity);
                    onSeverityClose();
                  }}
                  className={`${colors[severity]} text-white px-4 py-2 rounded text-sm font-medium transition-colors capitalize flex-1`}
                >
                  {severity === 'low' ? 'Baixa' : severity === 'medium' ? 'Média' : 'Alta'}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const InjuryMap: React.FC<InjuryMapProps> = ({
  onChange,
  initialInjuries = [],
}) => {
  // Mapa de lesões: id -> { type, severity }
  const [injuries, setInjuries] = useState<Map<string, { type: 'muscle' | 'joint'; severity: Severity }>>(
    new Map(initialInjuries.map(i => [i.id, { type: i.type, severity: i.severity }]))
  );
  
  // Apenas um seletor de severidade ativo por vez
  const [activeSeveritySelector, setActiveSeveritySelector] = useState<{ id: string; type: 'muscle' | 'joint'; name: string } | null>(null);

  // Encontrar todas as áreas/joints para um grupo muscular/articulação
  const findAreasForMuscle = (muscleGroup: MuscleGroup, view?: 'front' | 'back') => {
    return muscleAreas.filter(a => 
      a.muscleGroup === muscleGroup && 
      (view ? a.view === view : true)
    );
  };

  const findJointsForGroup = (jointGroup: JointGroup, view?: 'front' | 'back') => {
    return jointMarkers.filter(j => 
      j.jointGroup === jointGroup && 
      (view ? j.view === view : true)
    );
  };

  const handleAreaClick = useCallback((areaId: string, muscleGroup: MuscleGroup, label: string) => {
    // Fechar qualquer seletor ativo antes de abrir um novo
    setActiveSeveritySelector(null);
    
    const existingInjury = injuries.get(areaId);

    if (existingInjury) {
      // Se já existe, mostrar seletor de severidade
      setActiveSeveritySelector({
        id: areaId,
        type: 'muscle',
        name: label,
      });
    } else {
      // Se não existe, adicionar com severidade padrão 'low'
      const newInjuries = new Map(injuries);
      newInjuries.set(areaId, { type: 'muscle', severity: 'low' });
      setInjuries(newInjuries);
      
      // Mostrar seletor de severidade imediatamente
      setActiveSeveritySelector({
        id: areaId,
        type: 'muscle',
        name: label,
      });
    }
  }, [injuries]);

  const handleJointClick = useCallback((jointId: string, jointGroup: JointGroup, label: string) => {
    // Fechar qualquer seletor ativo antes de abrir um novo
    setActiveSeveritySelector(null);
    
    const existingInjury = injuries.get(jointId);

    if (existingInjury) {
      // Se já existe, mostrar seletor de severidade
      setActiveSeveritySelector({
        id: jointId,
        type: 'joint',
        name: label,
      });
    } else {
      // Se não existe, adicionar com severidade padrão 'low'
      const newInjuries = new Map(injuries);
      newInjuries.set(jointId, { type: 'joint', severity: 'low' });
      setInjuries(newInjuries);
      
      // Mostrar seletor de severidade imediatamente
      setActiveSeveritySelector({
        id: jointId,
        type: 'joint',
        name: label,
      });
    }
  }, [injuries]);

  const handleSeveritySelect = useCallback((id: string, type: 'muscle' | 'joint', severity: Severity) => {
    setInjuries(prev => {
      const newMap = new Map(prev);
      newMap.set(id, { type, severity });
      return newMap;
    });
  }, []);

  const handleSeverityClose = useCallback(() => {
    setActiveSeveritySelector(null);
  }, []);

  // Converter lesões para o formato de saída
  useEffect(() => {
    if (onChange) {
      const injuriesArray: Injury[] = Array.from(injuries.entries()).map(([id, data]) => ({
        id,
        type: data.type,
        severity: data.severity,
      }));
      onChange(injuriesArray);
    }
  }, [injuries, onChange]);

  // Função para remover lesão
  const removeInjury = useCallback((id: string) => {
    setInjuries(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
    if (activeSeveritySelector?.id === id) {
      setActiveSeveritySelector(null);
    }
  }, [activeSeveritySelector]);

  // Labels para exibição
  const getInjuryLabel = (id: string, type: 'muscle' | 'joint') => {
    if (type === 'muscle') {
      const area = muscleAreas.find(a => a.id === id);
      return area?.label || id;
    } else {
      const joint = jointMarkers.find(j => j.id === id);
      return joint?.label || id;
    }
  };

  return (
    <div className="w-full bg-card-bg border border-gray-800 rounded-lg p-4">
      <div className="mb-4">
        <h3 className="text-alien-green font-semibold text-lg mb-2">Mapa de Lesões</h3>
        <p className="text-gray-400 text-sm">
          Clique nas áreas musculares ou articulações para marcar lesões. Clique novamente para ajustar a severidade.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vista Frontal */}
        <div className="flex flex-col items-center">
          <h4 className="text-gray-300 font-medium mb-3">Vista Frontal</h4>
          <FrontSilhouette
            selectedItems={injuries}
            onAreaClick={handleAreaClick}
            onJointClick={handleJointClick}
            activeSeveritySelector={activeSeveritySelector}
            onSeveritySelect={handleSeveritySelect}
            onSeverityClose={handleSeverityClose}
          />
        </div>

        {/* Vista Traseira */}
        <div className="flex flex-col items-center">
          <h4 className="text-gray-300 font-medium mb-3">Vista Traseira</h4>
          <BackSilhouette
            selectedItems={injuries}
            onAreaClick={handleAreaClick}
            onJointClick={handleJointClick}
            activeSeveritySelector={activeSeveritySelector}
            onSeveritySelect={handleSeveritySelect}
            onSeverityClose={handleSeverityClose}
          />
        </div>
      </div>

      {/* Lista de lesões selecionadas */}
      {injuries.size > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-800">
          <h4 className="text-gray-300 font-medium mb-3">Lesões Registradas:</h4>
          <div className="flex flex-wrap gap-2">
            {Array.from(injuries.entries()).map(([id, data]) => {
              const severity = data.severity;
              const severityColors = {
                low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500',
                medium: 'bg-amber-500/20 text-amber-400 border-amber-500',
                high: 'bg-red-500/20 text-red-400 border-red-500',
              };
              const severityLabels = {
                low: 'Baixa',
                medium: 'Média',
                high: 'Alta',
              };

              return (
                <div
                  key={id}
                  className={`px-3 py-1 rounded-lg border ${severityColors[severity]} text-sm flex items-center gap-2`}
                >
                  <span>{getInjuryLabel(id, data.type)}</span>
                  <span className="text-xs opacity-75">({severityLabels[severity]})</span>
                  <button
                    onClick={() => removeInjury(id)}
                    className="ml-1 hover:text-white transition-colors"
                    aria-label="Remover lesão"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex flex-wrap gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-500 rounded"></div>
            <span>Severidade Baixa</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-500 rounded"></div>
            <span>Severidade Média</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Severidade Alta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-alien-green rounded-full"></div>
            <span>Selecionado (Glow Neon)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
