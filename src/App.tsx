import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Port,
  Wire,
  ScopeState,
  FunctionGenState,
  PowerSupplyState,
  MultimeterState,
} from './types/lab';
import { solveActiveCircuit, SignalSample } from './sim/circuitEngine';
import { Oscilloscope } from './instruments/Oscilloscope';
import { FunctionGenerator } from './instruments/FunctionGenerator';
import { PowerSupply } from './instruments/PowerSupply';
import { Multimeter } from './instruments/Multimeter';
import { TrainingBoard } from './instruments/TrainingBoard';
import { MeasurementsBoard } from './instruments/MeasurementsBoard';
import { FilterBoard } from './instruments/FilterBoard';
import { BananaLeads } from './instruments/NewInstruments';
import { WireOverlay } from './wiring/WireOverlay';
import { Toolbar } from './components/Toolbar';
import { InstrumentDrawer } from './components/InstrumentDrawer';
import { labAudio } from './utils/audio';

export type InstrumentType = 'scope' | 'gen' | 'psu' | 'dmm' | 'board' | 'measurements_board' | 'filterboard' | 'leads';

export interface BenchInstrument {
  instanceId: string;
  type: InstrumentType;
  x: number;
  y: number;
}

// Generate physical ports dynamically per instrument instance
export const getPortsForInstance = (instanceId: string, type: InstrumentType): Port[] => {
  switch (type) {
    case 'scope':
      return [
        { id: `${instanceId}:ch1`, parentId: instanceId, name: 'CH1 BNC', type: 'bnc', color: '#06b6d4', label: 'CH1 (X)', x: 0, y: 0 },
        { id: `${instanceId}:ch2`, parentId: instanceId, name: 'CH2 BNC', type: 'bnc', color: '#facc15', label: 'CH2 (Y)', x: 0, y: 0 },
        { id: `${instanceId}:ext_trig`, parentId: instanceId, name: 'EXT TRIG BNC', type: 'bnc', color: '#94a3b8', label: 'EXT TRIG', x: 0, y: 0 },
        { id: `${instanceId}:probe_comp`, parentId: instanceId, name: 'PROBE COMP', type: 'banana', color: '#38bdf8', label: '3V 1kHz', x: 0, y: 0 },
      ];
    case 'gen':
      return [
        { id: `${instanceId}:output`, parentId: instanceId, name: 'OUTPUT 50Ω', type: 'bnc', color: '#38bdf8', label: 'OUTPUT', x: 0, y: 0 },
        { id: `${instanceId}:ttl`, parentId: instanceId, name: 'TTL/CMOS', type: 'bnc', color: '#94a3b8', label: 'TTL', x: 0, y: 0 },
        { id: `${instanceId}:vcf`, parentId: instanceId, name: 'VCF IN', type: 'bnc', color: '#94a3b8', label: 'VCF', x: 0, y: 0 },
        { id: `${instanceId}:counter`, parentId: instanceId, name: 'COUNTER IN', type: 'bnc', color: '#94a3b8', label: 'COUNT', x: 0, y: 0 },
      ];
    case 'leads':
      return [
        { id: `${instanceId}:lead_bnc`, parentId: instanceId, name: 'Adapter BNC end', type: 'bnc', color: '#94a3b8', label: 'BNC', x: 0, y: 0 },
        { id: `${instanceId}:lead_pos`, parentId: instanceId, name: 'Adapter (+) red', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:lead_neg`, parentId: instanceId, name: 'Adapter (−) black', type: 'banana', color: '#1e293b', label: '−', x: 0, y: 0 },
      ];
    case 'psu':
      return [
        { id: `${instanceId}:pos`, parentId: instanceId, name: 'PSU (+)', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:neg`, parentId: instanceId, name: 'PSU (-)', type: 'banana', color: '#1e293b', label: '-', x: 0, y: 0 },
        { id: `${instanceId}:gnd`, parentId: instanceId, name: 'PSU (GND)', type: 'banana', color: '#10b981', label: 'GND', x: 0, y: 0 },
      ];
    case 'dmm':
      return [
        { id: `${instanceId}:10a`, parentId: instanceId, name: '10A MAX', type: 'banana', color: '#1e293b', label: '10A', x: 0, y: 0 },
        { id: `${instanceId}:com`, parentId: instanceId, name: 'COM', type: 'banana', color: '#1e293b', label: 'COM', x: 0, y: 0 },
        { id: `${instanceId}:v_ohm`, parentId: instanceId, name: 'V-Ω-mA', type: 'banana', color: '#ef4444', label: 'VΩmA', x: 0, y: 0 },
      ];
    case 'board':
      return [
        // Galvanometer J0409
        { id: `${instanceId}:GALV:neg`, parentId: instanceId, name: 'Galvanometer [-]', type: 'banana', color: '#1e293b', label: '[-]', x: 0, y: 0 },
        { id: `${instanceId}:GALV:g0`, parentId: instanceId, name: 'Galvanometer G0 (100Ω)', type: 'banana', color: '#1e293b', label: 'G0', x: 0, y: 0 },
        { id: `${instanceId}:GALV:g1`, parentId: instanceId, name: 'Galvanometer G1 (+) (2.4K)', type: 'banana', color: '#ef4444', label: 'G1 (+)', x: 0, y: 0 },
        // Capacitors (12 on Board 1)
        { id: `${instanceId}:C_001u_1:a`, parentId: instanceId, name: 'C 0.001µF (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_001u_1:b`, parentId: instanceId, name: 'C 0.001µF (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_005u:a`, parentId: instanceId, name: 'C 0.005µF A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_005u:b`, parentId: instanceId, name: 'C 0.005µF B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_001u_2:a`, parentId: instanceId, name: 'C 0.001µF (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_001u_2:b`, parentId: instanceId, name: 'C 0.001µF (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_02u:a`, parentId: instanceId, name: 'C 0.2µF A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_02u:b`, parentId: instanceId, name: 'C 0.2µF B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_01u_1:a`, parentId: instanceId, name: 'C 0.01µF (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_01u_1:b`, parentId: instanceId, name: 'C 0.01µF (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_1u:a`, parentId: instanceId, name: 'C 1.0µF A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_1u:b`, parentId: instanceId, name: 'C 1.0µF B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_01u_2:a`, parentId: instanceId, name: 'C 0.01µF (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_01u_2:b`, parentId: instanceId, name: 'C 0.01µF (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_47u:pos`, parentId: instanceId, name: 'C 47µF (+)', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:C_47u:neg`, parentId: instanceId, name: 'C 47µF (-)', type: 'banana', color: '#1e293b', label: '-', x: 0, y: 0 },
        { id: `${instanceId}:C_1u_1:a`, parentId: instanceId, name: 'C 0.1µF (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_1u_1:b`, parentId: instanceId, name: 'C 0.1µF (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_470u:pos`, parentId: instanceId, name: 'C 470µF (+)', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:C_470u:neg`, parentId: instanceId, name: 'C 470µF (-)', type: 'banana', color: '#1e293b', label: '-', x: 0, y: 0 },
        { id: `${instanceId}:C_1u_2:a`, parentId: instanceId, name: 'C 0.1µF (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_1u_2:b`, parentId: instanceId, name: 'C 0.1µF (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_1000u:pos`, parentId: instanceId, name: 'C 1000µF (+)', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:C_1000u:neg`, parentId: instanceId, name: 'C 1000µF (-)', type: 'banana', color: '#1e293b', label: '-', x: 0, y: 0 },
        // Inductors
        { id: `${instanceId}:L_5mH_1:a`, parentId: instanceId, name: 'Inductor 5mH (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_5mH_1:b`, parentId: instanceId, name: 'Inductor 5mH (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_5mH_2:a`, parentId: instanceId, name: 'Inductor 5mH (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_5mH_2:b`, parentId: instanceId, name: 'Inductor 5mH (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_5mH:a`, parentId: instanceId, name: 'Choke 5mH A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_5mH:b`, parentId: instanceId, name: 'Choke 5mH B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_10mH_1:a`, parentId: instanceId, name: 'Inductor 10mH (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_10mH_1:b`, parentId: instanceId, name: 'Inductor 10mH (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_10mH_2:a`, parentId: instanceId, name: 'Inductor 10mH (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_10mH_2:b`, parentId: instanceId, name: 'Inductor 10mH (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_20mH_1:a`, parentId: instanceId, name: 'Inductor 20mH (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_20mH_1:b`, parentId: instanceId, name: 'Inductor 20mH (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_20mH_2:a`, parentId: instanceId, name: 'Inductor 20mH (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_20mH_2:b`, parentId: instanceId, name: 'Inductor 20mH (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        // Diodes
        { id: `${instanceId}:D1:a`, parentId: instanceId, name: 'Diode D1 Anode (+)', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:D1:k`, parentId: instanceId, name: 'Diode D1 Cathode (-)', type: 'banana', color: '#1e293b', label: 'K', x: 0, y: 0 },
        { id: `${instanceId}:D2:a`, parentId: instanceId, name: 'Diode D2 Anode (+)', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:D2:k`, parentId: instanceId, name: 'Diode D2 Cathode (-)', type: 'banana', color: '#1e293b', label: 'K', x: 0, y: 0 },
        { id: `${instanceId}:D3:a`, parentId: instanceId, name: 'Diode D3 Anode (+)', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:D3:k`, parentId: instanceId, name: 'Diode D3 Cathode (-)', type: 'banana', color: '#1e293b', label: 'K', x: 0, y: 0 },
        { id: `${instanceId}:D_1N4007:a`, parentId: instanceId, name: 'Diode 1N4007 Anode (+)', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:D_1N4007:k`, parentId: instanceId, name: 'Diode 1N4007 Cathode (-)', type: 'banana', color: '#1e293b', label: 'K', x: 0, y: 0 },
        // Bridge Rectifiers
        { id: `${instanceId}:BR1:ac1`, parentId: instanceId, name: 'Bridge 1 AC IN 1', type: 'banana', color: '#f59e0b', label: 'AC1', x: 0, y: 0 },
        { id: `${instanceId}:BR1:ac2`, parentId: instanceId, name: 'Bridge 1 AC IN 2', type: 'banana', color: '#f59e0b', label: 'AC2', x: 0, y: 0 },
        { id: `${instanceId}:BR1:pos`, parentId: instanceId, name: 'Bridge 1 DC OUT (+)', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:BR1:neg`, parentId: instanceId, name: 'Bridge 1 DC OUT (-)', type: 'banana', color: '#1e293b', label: '-', x: 0, y: 0 },
        { id: `${instanceId}:BR:ac1`, parentId: instanceId, name: 'Bridge Rectifier AC IN 1', type: 'banana', color: '#f59e0b', label: 'AC1', x: 0, y: 0 },
        { id: `${instanceId}:BR:ac2`, parentId: instanceId, name: 'Bridge Rectifier AC IN 2', type: 'banana', color: '#f59e0b', label: 'AC2', x: 0, y: 0 },
        { id: `${instanceId}:BR:pos`, parentId: instanceId, name: 'Bridge Rectifier DC OUT (+)', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:BR:neg`, parentId: instanceId, name: 'Bridge Rectifier DC OUT (-)', type: 'banana', color: '#1e293b', label: '-', x: 0, y: 0 },
        // Transistors
        { id: `${instanceId}:Q_NPN1:b`, parentId: instanceId, name: 'NPN 1 Base', type: 'banana', color: '#0284c7', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:Q_NPN1:c`, parentId: instanceId, name: 'NPN 1 Collector', type: 'banana', color: '#ef4444', label: 'C', x: 0, y: 0 },
        { id: `${instanceId}:Q_NPN1:e`, parentId: instanceId, name: 'NPN 1 Emitter', type: 'banana', color: '#1e293b', label: 'E', x: 0, y: 0 },
        { id: `${instanceId}:Q_NPN:b`, parentId: instanceId, name: 'NPN Base', type: 'banana', color: '#0284c7', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:Q_NPN:c`, parentId: instanceId, name: 'NPN Collector', type: 'banana', color: '#ef4444', label: 'C', x: 0, y: 0 },
        { id: `${instanceId}:Q_NPN:e`, parentId: instanceId, name: 'NPN Emitter', type: 'banana', color: '#1e293b', label: 'E', x: 0, y: 0 },
        { id: `${instanceId}:Q_PNP1:b`, parentId: instanceId, name: 'PNP 1 Base', type: 'banana', color: '#0284c7', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:Q_PNP1:c`, parentId: instanceId, name: 'PNP 1 Collector', type: 'banana', color: '#ef4444', label: 'C', x: 0, y: 0 },
        { id: `${instanceId}:Q_PNP1:e`, parentId: instanceId, name: 'PNP 1 Emitter', type: 'banana', color: '#1e293b', label: 'E', x: 0, y: 0 },
        { id: `${instanceId}:Q_PNP:b`, parentId: instanceId, name: 'PNP Base', type: 'banana', color: '#0284c7', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:Q_PNP:c`, parentId: instanceId, name: 'PNP Collector', type: 'banana', color: '#ef4444', label: 'C', x: 0, y: 0 },
        { id: `${instanceId}:Q_PNP:e`, parentId: instanceId, name: 'PNP Emitter', type: 'banana', color: '#1e293b', label: 'E', x: 0, y: 0 },
        { id: `${instanceId}:Q_NFET:g`, parentId: instanceId, name: 'NFET Gate', type: 'banana', color: '#0284c7', label: 'G', x: 0, y: 0 },
        { id: `${instanceId}:Q_NFET:d`, parentId: instanceId, name: 'NFET Drain', type: 'banana', color: '#ef4444', label: 'D', x: 0, y: 0 },
        { id: `${instanceId}:Q_NFET:s`, parentId: instanceId, name: 'NFET Source', type: 'banana', color: '#1e293b', label: 'S', x: 0, y: 0 },
        { id: `${instanceId}:Q_PFET:g`, parentId: instanceId, name: 'PFET Gate', type: 'banana', color: '#0284c7', label: 'G', x: 0, y: 0 },
        { id: `${instanceId}:Q_PFET:d`, parentId: instanceId, name: 'PFET Drain', type: 'banana', color: '#ef4444', label: 'D', x: 0, y: 0 },
        { id: `${instanceId}:Q_PFET:s`, parentId: instanceId, name: 'PFET Source', type: 'banana', color: '#1e293b', label: 'S', x: 0, y: 0 },
        // Op-Amps
        { id: `${instanceId}:OP1:in_n`, parentId: instanceId, name: 'LM741 (1) IN-', type: 'banana', color: '#0284c7', label: 'IN-', x: 0, y: 0 },
        { id: `${instanceId}:OP1:in_p`, parentId: instanceId, name: 'LM741 (1) IN+', type: 'banana', color: '#0284c7', label: 'IN+', x: 0, y: 0 },
        { id: `${instanceId}:OP1:vcc_p`, parentId: instanceId, name: 'LM741 (1) V+', type: 'banana', color: '#ef4444', label: 'V+', x: 0, y: 0 },
        { id: `${instanceId}:OP1:vcc_n`, parentId: instanceId, name: 'LM741 (1) V-', type: 'banana', color: '#1e293b', label: 'V-', x: 0, y: 0 },
        { id: `${instanceId}:OP1:out`, parentId: instanceId, name: 'LM741 (1) OUT', type: 'banana', color: '#10b981', label: 'OUT', x: 0, y: 0 },
        { id: `${instanceId}:OPAMP:in_n`, parentId: instanceId, name: 'LM741 IN-', type: 'banana', color: '#0284c7', label: 'IN-', x: 0, y: 0 },
        { id: `${instanceId}:OPAMP:in_p`, parentId: instanceId, name: 'LM741 IN+', type: 'banana', color: '#0284c7', label: 'IN+', x: 0, y: 0 },
        { id: `${instanceId}:OPAMP:vcc_p`, parentId: instanceId, name: 'LM741 V+', type: 'banana', color: '#ef4444', label: 'V+', x: 0, y: 0 },
        { id: `${instanceId}:OPAMP:vcc_n`, parentId: instanceId, name: 'LM741 V-', type: 'banana', color: '#1e293b', label: 'V-', x: 0, y: 0 },
        { id: `${instanceId}:OPAMP:out`, parentId: instanceId, name: 'LM741 OUT', type: 'banana', color: '#10b981', label: 'OUT', x: 0, y: 0 },
        // 555 Timer IC
        { id: `${instanceId}:IC555:pin1`, parentId: instanceId, name: '555 Pin 1 (GND)', type: 'banana', color: '#1e293b', label: '1', x: 0, y: 0 },
        { id: `${instanceId}:IC555:pin2`, parentId: instanceId, name: '555 Pin 2 (TRIG)', type: 'banana', color: '#1e293b', label: '2', x: 0, y: 0 },
        { id: `${instanceId}:IC555:pin3`, parentId: instanceId, name: '555 Pin 3 (OUT)', type: 'banana', color: '#0284c7', label: '3', x: 0, y: 0 },
        { id: `${instanceId}:IC555:pin4`, parentId: instanceId, name: '555 Pin 4 (RESET)', type: 'banana', color: '#ef4444', label: '4', x: 0, y: 0 },
        { id: `${instanceId}:IC555:pin5`, parentId: instanceId, name: '555 Pin 5 (CONT)', type: 'banana', color: '#1e293b', label: '5', x: 0, y: 0 },
        { id: `${instanceId}:IC555:pin6`, parentId: instanceId, name: '555 Pin 6 (THRESH)', type: 'banana', color: '#1e293b', label: '6', x: 0, y: 0 },
        { id: `${instanceId}:IC555:pin7`, parentId: instanceId, name: '555 Pin 7 (DISCH)', type: 'banana', color: '#1e293b', label: '7', x: 0, y: 0 },
        { id: `${instanceId}:IC555:pin8`, parentId: instanceId, name: '555 Pin 8 (VCC)', type: 'banana', color: '#ef4444', label: '8', x: 0, y: 0 },
        // Resistors
        { id: `${instanceId}:R_5k_1:a`, parentId: instanceId, name: 'Resistor 5kΩ (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_5k_1:b`, parentId: instanceId, name: 'Resistor 5kΩ (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_50:a`, parentId: instanceId, name: 'Resistor 50Ω A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_50:b`, parentId: instanceId, name: 'Resistor 50Ω B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_10k_1:a`, parentId: instanceId, name: 'Resistor 10kΩ (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_10k_1:b`, parentId: instanceId, name: 'Resistor 10kΩ (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_100:a`, parentId: instanceId, name: 'Resistor 100Ω A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_100:b`, parentId: instanceId, name: 'Resistor 100Ω B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_10k_2:a`, parentId: instanceId, name: 'Resistor 10kΩ (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_10k_2:b`, parentId: instanceId, name: 'Resistor 10kΩ (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_220:a`, parentId: instanceId, name: 'Resistor 220Ω A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_220:b`, parentId: instanceId, name: 'Resistor 220Ω B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_50k:a`, parentId: instanceId, name: 'Resistor 50kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_50k:b`, parentId: instanceId, name: 'Resistor 50kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_470:a`, parentId: instanceId, name: 'Resistor 470Ω A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_470:b`, parentId: instanceId, name: 'Resistor 470Ω B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_100k:a`, parentId: instanceId, name: 'Resistor 100kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_100k:b`, parentId: instanceId, name: 'Resistor 100kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_560:a`, parentId: instanceId, name: 'Resistor 560Ω A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_560:b`, parentId: instanceId, name: 'Resistor 560Ω B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_200k_1:a`, parentId: instanceId, name: 'Resistor 200kΩ (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_200k_1:b`, parentId: instanceId, name: 'Resistor 200kΩ (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_1k_1:a`, parentId: instanceId, name: 'Resistor 1kΩ (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_1k_1:b`, parentId: instanceId, name: 'Resistor 1kΩ (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_200k_2:a`, parentId: instanceId, name: 'Resistor 200kΩ (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_200k_2:b`, parentId: instanceId, name: 'Resistor 200kΩ (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_1k_2:a`, parentId: instanceId, name: 'Resistor 1kΩ (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_1k_2:b`, parentId: instanceId, name: 'Resistor 1kΩ (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_500k:a`, parentId: instanceId, name: 'Resistor 500kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_500k:b`, parentId: instanceId, name: 'Resistor 500kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_2k2:a`, parentId: instanceId, name: 'Resistor 2.2kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_2k2:b`, parentId: instanceId, name: 'Resistor 2.2kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_1M:a`, parentId: instanceId, name: 'Resistor 1MΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_1M:b`, parentId: instanceId, name: 'Resistor 1MΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_5k_2:a`, parentId: instanceId, name: 'Resistor 5kΩ (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_5k_2:b`, parentId: instanceId, name: 'Resistor 5kΩ (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        // Compatibility Aliases
        { id: `${instanceId}:R_1k:a`, parentId: instanceId, name: 'Resistor 1kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_1k:b`, parentId: instanceId, name: 'Resistor 1kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_10k:a`, parentId: instanceId, name: 'Resistor 10kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_10k:b`, parentId: instanceId, name: 'Resistor 10kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_4k7:a`, parentId: instanceId, name: 'Resistor 4.7kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_4k7:b`, parentId: instanceId, name: 'Resistor 4.7kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_20k:a`, parentId: instanceId, name: 'Resistor 20kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_20k:b`, parentId: instanceId, name: 'Resistor 20kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_47k:a`, parentId: instanceId, name: 'Resistor 47kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_47k:b`, parentId: instanceId, name: 'Resistor 47kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        // Potentiometers
        { id: `${instanceId}:POT_5k:1`, parentId: instanceId, name: 'Pot 5k Pin 1', type: 'banana', color: '#ef4444', label: '1', x: 0, y: 0 },
        { id: `${instanceId}:POT_5k:w`, parentId: instanceId, name: 'Pot 5k Wiper', type: 'banana', color: '#0284c7', label: 'W', x: 0, y: 0 },
        { id: `${instanceId}:POT_5k:3`, parentId: instanceId, name: 'Pot 5k Pin 3', type: 'banana', color: '#1e293b', label: '3', x: 0, y: 0 },
        { id: `${instanceId}:POT_100k:1`, parentId: instanceId, name: 'Pot 100k Pin 1', type: 'banana', color: '#ef4444', label: '1', x: 0, y: 0 },
        { id: `${instanceId}:POT_100k:w`, parentId: instanceId, name: 'Pot 100k Wiper', type: 'banana', color: '#0284c7', label: 'W', x: 0, y: 0 },
        { id: `${instanceId}:POT_100k:3`, parentId: instanceId, name: 'Pot 100k Pin 3', type: 'banana', color: '#1e293b', label: '3', x: 0, y: 0 },
        { id: `${instanceId}:POT_1M:1`, parentId: instanceId, name: 'Pot 1M Pin 1', type: 'banana', color: '#ef4444', label: '1', x: 0, y: 0 },
        { id: `${instanceId}:POT_1M:w`, parentId: instanceId, name: 'Pot 1M Wiper', type: 'banana', color: '#0284c7', label: 'W', x: 0, y: 0 },
        { id: `${instanceId}:POT_1M:3`, parentId: instanceId, name: 'Pot 1M Pin 3', type: 'banana', color: '#1e293b', label: '3', x: 0, y: 0 },
        { id: `${instanceId}:POT_10k:1`, parentId: instanceId, name: 'Pot 10k Pin 1', type: 'banana', color: '#ef4444', label: '1', x: 0, y: 0 },
        { id: `${instanceId}:POT_10k:w`, parentId: instanceId, name: 'Pot 10k Wiper', type: 'banana', color: '#0284c7', label: 'W', x: 0, y: 0 },
        { id: `${instanceId}:POT_10k:3`, parentId: instanceId, name: 'Pot 10k Pin 3', type: 'banana', color: '#1e293b', label: '3', x: 0, y: 0 },
        // Power Distribution Bus
        { id: `${instanceId}:PWR:ac12_1`, parentId: instanceId, name: '12V AC (1)', type: 'banana', color: '#f59e0b', label: 'AC', x: 0, y: 0 },
        { id: `${instanceId}:PWR:ac12_2`, parentId: instanceId, name: '12V AC (2)', type: 'banana', color: '#f59e0b', label: 'AC', x: 0, y: 0 },
        { id: `${instanceId}:PWR:p12v`, parentId: instanceId, name: 'DC Rail +12V', type: 'banana', color: '#ef4444', label: '+12V', x: 0, y: 0 },
        { id: `${instanceId}:PWR:n12v`, parentId: instanceId, name: 'DC Rail -12V', type: 'banana', color: '#0284c7', label: '-12V', x: 0, y: 0 },
        { id: `${instanceId}:PWR:p5v`, parentId: instanceId, name: 'DC Rail +5V', type: 'banana', color: '#ef4444', label: '+5V', x: 0, y: 0 },
        { id: `${instanceId}:PWR:gnd`, parentId: instanceId, name: 'DC Rail GND / COM', type: 'banana', color: '#1e293b', label: 'GND', x: 0, y: 0 },
      ];
    case 'measurements_board':
      return [
        // Microammeter (µA)
        { id: `${instanceId}:UA:pos`, parentId: instanceId, name: 'Microammeter (+)', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:UA:neg`, parentId: instanceId, name: 'Microammeter (-)', type: 'banana', color: '#1e293b', label: '-', x: 0, y: 0 },
        // Capacitors (14 on Board 2)
        { id: `${instanceId}:C_001u_1:a`, parentId: instanceId, name: 'C 0.001µF (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_001u_1:b`, parentId: instanceId, name: 'C 0.001µF (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_005u_1:a`, parentId: instanceId, name: 'C 0.005µF (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_005u_1:b`, parentId: instanceId, name: 'C 0.005µF (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_001u_2:a`, parentId: instanceId, name: 'C 0.001µF (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_001u_2:b`, parentId: instanceId, name: 'C 0.001µF (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_005u_2:a`, parentId: instanceId, name: 'C 0.005µF (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_005u_2:b`, parentId: instanceId, name: 'C 0.005µF (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_01u_1:a`, parentId: instanceId, name: 'C 0.01µF (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_01u_1:b`, parentId: instanceId, name: 'C 0.01µF (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_02u:a`, parentId: instanceId, name: 'C 0.2µF A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_02u:b`, parentId: instanceId, name: 'C 0.2µF B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_01u_2:a`, parentId: instanceId, name: 'C 0.01µF (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_01u_2:b`, parentId: instanceId, name: 'C 0.01µF (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_1u:a`, parentId: instanceId, name: 'C 1.0µF A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_1u:b`, parentId: instanceId, name: 'C 1.0µF B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_01u_3:a`, parentId: instanceId, name: 'C 0.01µF (3) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_01u_3:b`, parentId: instanceId, name: 'C 0.01µF (3) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_47u:pos`, parentId: instanceId, name: 'C 47µF (+)', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:C_47u:neg`, parentId: instanceId, name: 'C 47µF (-)', type: 'banana', color: '#1e293b', label: '-', x: 0, y: 0 },
        { id: `${instanceId}:C_1u_1:a`, parentId: instanceId, name: 'C 0.1µF (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_1u_1:b`, parentId: instanceId, name: 'C 0.1µF (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_470u:pos`, parentId: instanceId, name: 'C 470µF (+)', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:C_470u:neg`, parentId: instanceId, name: 'C 470µF (-)', type: 'banana', color: '#1e293b', label: '-', x: 0, y: 0 },
        { id: `${instanceId}:C_1u_2:a`, parentId: instanceId, name: 'C 0.1µF (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:C_1u_2:b`, parentId: instanceId, name: 'C 0.1µF (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:C_1000u:pos`, parentId: instanceId, name: 'C 1000µF (+)', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:C_1000u:neg`, parentId: instanceId, name: 'C 1000µF (-)', type: 'banana', color: '#1e293b', label: '-', x: 0, y: 0 },
        // Inductors (8 total, including 100mH)
        { id: `${instanceId}:L_5mH_1:a`, parentId: instanceId, name: 'Inductor 5mH (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_5mH_1:b`, parentId: instanceId, name: 'Inductor 5mH (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_5mH_2:a`, parentId: instanceId, name: 'Inductor 5mH (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_5mH_2:b`, parentId: instanceId, name: 'Inductor 5mH (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_10mH_1:a`, parentId: instanceId, name: 'Inductor 10mH (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_10mH_1:b`, parentId: instanceId, name: 'Inductor 10mH (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_10mH_2:a`, parentId: instanceId, name: 'Inductor 10mH (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_10mH_2:b`, parentId: instanceId, name: 'Inductor 10mH (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_20mH_1:a`, parentId: instanceId, name: 'Inductor 20mH (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_20mH_1:b`, parentId: instanceId, name: 'Inductor 20mH (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_20mH_2:a`, parentId: instanceId, name: 'Inductor 20mH (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_20mH_2:b`, parentId: instanceId, name: 'Inductor 20mH (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_100mH_1:a`, parentId: instanceId, name: 'Inductor 100mH (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_100mH_1:b`, parentId: instanceId, name: 'Inductor 100mH (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:L_100mH_2:a`, parentId: instanceId, name: 'Inductor 100mH (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:L_100mH_2:b`, parentId: instanceId, name: 'Inductor 100mH (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        // Diodes
        { id: `${instanceId}:D_M1:a`, parentId: instanceId, name: 'Diode M1 Anode', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:D_M1:k`, parentId: instanceId, name: 'Diode M1 Cathode', type: 'banana', color: '#1e293b', label: 'K', x: 0, y: 0 },
        { id: `${instanceId}:D_M2:a`, parentId: instanceId, name: 'Diode M2 Anode', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:D_M2:k`, parentId: instanceId, name: 'Diode M2 Cathode', type: 'banana', color: '#1e293b', label: 'K', x: 0, y: 0 },
        { id: `${instanceId}:D_M3:a`, parentId: instanceId, name: 'Diode M3 Anode', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:D_M3:k`, parentId: instanceId, name: 'Diode M3 Cathode', type: 'banana', color: '#1e293b', label: 'K', x: 0, y: 0 },
        { id: `${instanceId}:D_M4:a`, parentId: instanceId, name: 'Diode M4 Anode', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:D_M4:k`, parentId: instanceId, name: 'Diode M4 Cathode', type: 'banana', color: '#1e293b', label: 'K', x: 0, y: 0 },
        // Bridge Rectifiers
        { id: `${instanceId}:BR1:ac1`, parentId: instanceId, name: 'Bridge 1 AC IN 1', type: 'banana', color: '#f59e0b', label: 'AC1', x: 0, y: 0 },
        { id: `${instanceId}:BR1:ac2`, parentId: instanceId, name: 'Bridge 1 AC IN 2', type: 'banana', color: '#f59e0b', label: 'AC2', x: 0, y: 0 },
        { id: `${instanceId}:BR1:pos`, parentId: instanceId, name: 'Bridge 1 DC OUT (+)', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:BR1:neg`, parentId: instanceId, name: 'Bridge 1 DC OUT (-)', type: 'banana', color: '#1e293b', label: '-', x: 0, y: 0 },
        { id: `${instanceId}:BR2:ac1`, parentId: instanceId, name: 'Bridge 2 AC IN 1', type: 'banana', color: '#f59e0b', label: 'AC1', x: 0, y: 0 },
        { id: `${instanceId}:BR2:ac2`, parentId: instanceId, name: 'Bridge 2 AC IN 2', type: 'banana', color: '#f59e0b', label: 'AC2', x: 0, y: 0 },
        { id: `${instanceId}:BR2:pos`, parentId: instanceId, name: 'Bridge 2 DC OUT (+)', type: 'banana', color: '#ef4444', label: '+', x: 0, y: 0 },
        { id: `${instanceId}:BR2:neg`, parentId: instanceId, name: 'Bridge 2 DC OUT (-)', type: 'banana', color: '#1e293b', label: '-', x: 0, y: 0 },
        // 4-way junction blocks (all four sockets are one node)
        { id: `${instanceId}:X1:n`, parentId: instanceId, name: 'Junction 1 (N)', type: 'banana', color: '#ef4444', label: 'J1', x: 0, y: 0 },
        { id: `${instanceId}:X1:e`, parentId: instanceId, name: 'Junction 1 (E)', type: 'banana', color: '#ef4444', label: 'J1', x: 0, y: 0 },
        { id: `${instanceId}:X1:s`, parentId: instanceId, name: 'Junction 1 (S)', type: 'banana', color: '#ef4444', label: 'J1', x: 0, y: 0 },
        { id: `${instanceId}:X1:w`, parentId: instanceId, name: 'Junction 1 (W)', type: 'banana', color: '#ef4444', label: 'J1', x: 0, y: 0 },
        { id: `${instanceId}:X2:n`, parentId: instanceId, name: 'Junction 2 (N)', type: 'banana', color: '#ef4444', label: 'J2', x: 0, y: 0 },
        { id: `${instanceId}:X2:e`, parentId: instanceId, name: 'Junction 2 (E)', type: 'banana', color: '#ef4444', label: 'J2', x: 0, y: 0 },
        { id: `${instanceId}:X2:s`, parentId: instanceId, name: 'Junction 2 (S)', type: 'banana', color: '#ef4444', label: 'J2', x: 0, y: 0 },
        { id: `${instanceId}:X2:w`, parentId: instanceId, name: 'Junction 2 (W)', type: 'banana', color: '#ef4444', label: 'J2', x: 0, y: 0 },
        // Variable (trimmer) capacitors
        { id: `${instanceId}:VC1:a`, parentId: instanceId, name: 'Variable Capacitor 1 (A)', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:VC1:b`, parentId: instanceId, name: 'Variable Capacitor 1 (B)', type: 'banana', color: '#ef4444', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:VC2:a`, parentId: instanceId, name: 'Variable Capacitor 2 (A)', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:VC2:b`, parentId: instanceId, name: 'Variable Capacitor 2 (B)', type: 'banana', color: '#ef4444', label: 'B', x: 0, y: 0 },
        // Resistors 18 Matrix
        { id: `${instanceId}:R_5k_1:a`, parentId: instanceId, name: 'Resistor 5kΩ (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_5k_1:b`, parentId: instanceId, name: 'Resistor 5kΩ (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_50:a`, parentId: instanceId, name: 'Resistor 50Ω A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_50:b`, parentId: instanceId, name: 'Resistor 50Ω B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_10k_1:a`, parentId: instanceId, name: 'Resistor 10kΩ (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_10k_1:b`, parentId: instanceId, name: 'Resistor 10kΩ (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_100:a`, parentId: instanceId, name: 'Resistor 100Ω A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_100:b`, parentId: instanceId, name: 'Resistor 100Ω B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_10k_2:a`, parentId: instanceId, name: 'Resistor 10kΩ (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_10k_2:b`, parentId: instanceId, name: 'Resistor 10kΩ (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_220:a`, parentId: instanceId, name: 'Resistor 220Ω A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_220:b`, parentId: instanceId, name: 'Resistor 220Ω B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_50k:a`, parentId: instanceId, name: 'Resistor 50kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_50k:b`, parentId: instanceId, name: 'Resistor 50kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_470:a`, parentId: instanceId, name: 'Resistor 470Ω A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_470:b`, parentId: instanceId, name: 'Resistor 470Ω B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_100k:a`, parentId: instanceId, name: 'Resistor 100kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_100k:b`, parentId: instanceId, name: 'Resistor 100kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_560:a`, parentId: instanceId, name: 'Resistor 560Ω A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_560:b`, parentId: instanceId, name: 'Resistor 560Ω B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_200k_1:a`, parentId: instanceId, name: 'Resistor 200kΩ (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_200k_1:b`, parentId: instanceId, name: 'Resistor 200kΩ (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_1k_1:a`, parentId: instanceId, name: 'Resistor 1kΩ (1) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_1k_1:b`, parentId: instanceId, name: 'Resistor 1kΩ (1) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_200k_2:a`, parentId: instanceId, name: 'Resistor 200kΩ (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_200k_2:b`, parentId: instanceId, name: 'Resistor 200kΩ (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_1k_2:a`, parentId: instanceId, name: 'Resistor 1kΩ (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_1k_2:b`, parentId: instanceId, name: 'Resistor 1kΩ (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_500k:a`, parentId: instanceId, name: 'Resistor 500kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_500k:b`, parentId: instanceId, name: 'Resistor 500kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_2k2:a`, parentId: instanceId, name: 'Resistor 2.2kΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_2k2:b`, parentId: instanceId, name: 'Resistor 2.2kΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_1M:a`, parentId: instanceId, name: 'Resistor 1MΩ A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_1M:b`, parentId: instanceId, name: 'Resistor 1MΩ B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        { id: `${instanceId}:R_5k_2:a`, parentId: instanceId, name: 'Resistor 5kΩ (2) A', type: 'banana', color: '#ef4444', label: 'A', x: 0, y: 0 },
        { id: `${instanceId}:R_5k_2:b`, parentId: instanceId, name: 'Resistor 5kΩ (2) B', type: 'banana', color: '#1e293b', label: 'B', x: 0, y: 0 },
        // Potentiometers
        { id: `${instanceId}:POT_5k:1`, parentId: instanceId, name: 'Pot 5k Pin 1', type: 'banana', color: '#ef4444', label: '1', x: 0, y: 0 },
        { id: `${instanceId}:POT_5k:w`, parentId: instanceId, name: 'Pot 5k Wiper', type: 'banana', color: '#0284c7', label: 'W', x: 0, y: 0 },
        { id: `${instanceId}:POT_5k:3`, parentId: instanceId, name: 'Pot 5k Pin 3', type: 'banana', color: '#1e293b', label: '3', x: 0, y: 0 },
        { id: `${instanceId}:POT_100k:1`, parentId: instanceId, name: 'Pot 100k Pin 1', type: 'banana', color: '#ef4444', label: '1', x: 0, y: 0 },
        { id: `${instanceId}:POT_100k:w`, parentId: instanceId, name: 'Pot 100k Wiper', type: 'banana', color: '#0284c7', label: 'W', x: 0, y: 0 },
        { id: `${instanceId}:POT_100k:3`, parentId: instanceId, name: 'Pot 100k Pin 3', type: 'banana', color: '#1e293b', label: '3', x: 0, y: 0 },
        { id: `${instanceId}:POT_1M:1`, parentId: instanceId, name: 'Pot 1M Pin 1', type: 'banana', color: '#ef4444', label: '1', x: 0, y: 0 },
        { id: `${instanceId}:POT_1M:w`, parentId: instanceId, name: 'Pot 1M Wiper', type: 'banana', color: '#0284c7', label: 'W', x: 0, y: 0 },
        { id: `${instanceId}:POT_1M:3`, parentId: instanceId, name: 'Pot 1M Pin 3', type: 'banana', color: '#1e293b', label: '3', x: 0, y: 0 },
      ];
    case 'filterboard': {
      const specs: Array<[string, string, string]> = [];
      for (const side of ['lpf', 'hpf']) {
        specs.push([`${side}_in_p`, `${side.toUpperCase()} Input (+)`, '#ef4444']);
        specs.push([`${side}_in_n`, `${side.toUpperCase()} Input (-)`, '#1e293b']);
        for (const j of ['j1', 'j3', 'j2', 'j4']) {
          specs.push([`${side}_${j}_a`, `${side.toUpperCase()} ${j.toUpperCase()} A`, '#cbd5e1']);
          specs.push([`${side}_${j}_b`, `${side.toUpperCase()} ${j.toUpperCase()} B`, '#cbd5e1']);
        }
        specs.push([`${side}_out_p`, `${side.toUpperCase()} Output (+)`, '#ef4444']);
        specs.push([`${side}_out_n`, `${side.toUpperCase()} Output (-)`, '#1e293b']);
      }
      for (const section of ['lpf', 'hpf', 'bpf']) {
        specs.push([`${section}_in`, `${section.toUpperCase()} Input`, '#ef4444']);
        specs.push([`${section}_out`, `${section.toUpperCase()} Output`, '#10b981']);
        specs.push([`${section}_tap_a`, `${section.toUpperCase()} Tap 1`, '#cbd5e1']);
        specs.push([`${section}_tap_b`, `${section.toUpperCase()} Tap 2`, '#cbd5e1']);
      }
      return specs.map(([suffix, name, color]) => ({
        id: `${instanceId}:${suffix}`, parentId: instanceId, name, type: 'banana' as const,
        color, label: name, x: 0, y: 0,
      }));
    }
    default:
      return [];
  }
};

export const INSTRUMENT_METADATA: Record<InstrumentType, { w: number; h: number; titleEn: string; titleAr: string; color: string }> = {
  scope: { w: 950, h: 540, titleEn: 'UTD2102CEX+ DIGITAL OSCILLOSCOPE', titleAr: 'راسم إشارة رقمي 100MHz', color: '#06b6d4' },
  gen: { w: 680, h: 510, titleEn: 'LW-1641 FUNCTION GENERATOR', titleAr: 'مولد ترددات وإشارات 2MHz', color: '#38bdf8' },
  psu: { w: 372, h: 344, titleEn: 'ATTEN APS3005S POWER SUPPLY', titleAr: 'مجهز قدرة مستمر 30V/5A', color: '#818cf8' },
  dmm: { w: 320, h: 540, titleEn: 'UNI-T UT33D+ MULTIMETER', titleAr: 'أفوميتر رقمي دقيق', color: '#34d399' },
  board: { w: 1180, h: 720, titleEn: 'INSTRUMENTS AND MEASUREMENTS TRAINING BOARD', titleAr: 'بورد أجهزة القياس والتجارب (EETC)', color: '#1e40af' },
  measurements_board: { w: 1230, h: 790, titleEn: 'INSTRUMENTS AND MEASUREMENTS TRAINING BOARD', titleAr: 'بورد أجهزة القياس والتجارب (EETC)', color: '#0284c7' },
  leads: { w: 150, h: 232, titleEn: 'BNC-BANANA ADAPTER (+/-)', titleAr: 'محوّل BNC إلى قطبين موجب وسالب', color: '#ef4444' },
  filterboard: { w: 1010, h: 720, titleEn: 'PASSIVE AND ACTIVE FILTER TRAINER', titleAr: 'بورد المرشحات الفعالة والسلبية', color: '#3b82f6' },
};


const LAB_SAVE_KEY = 'virtual-electronics-lab-session-v1';
function loadSavedState<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const saved = JSON.parse(window.localStorage.getItem(LAB_SAVE_KEY) || 'null');
    return saved && Object.prototype.hasOwnProperty.call(saved, key) ? saved[key] as T : fallback;
  } catch {
    return fallback;
  }
}

const INITIAL_BENCH: BenchInstrument[] = [
  { instanceId: 'scope-1', type: 'scope', x: 60, y: 50 },
  { instanceId: 'gen-1', type: 'gen', x: 1040, y: 50 },
  { instanceId: 'psu-1', type: 'psu', x: 1750, y: 50 },
  { instanceId: 'dmm-1', type: 'dmm', x: 2360, y: 50 },
  { instanceId: 'measurements_board-1', type: 'measurements_board', x: 60, y: 640 },
];

export default function App() {
  const workbenchRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const instCounterRef = useRef(1);
  const wireCounterRef = useRef(1);

  // Bench presence & movable positions supporting multiple instances
  const [benchInstruments, setBenchInstruments] = useState<BenchInstrument[]>(() => loadSavedState<BenchInstrument[]>('benchInstruments', INITIAL_BENCH).filter((i) => i && i.type in INSTRUMENT_METADATA));
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Windows OS-like stacking order: clicking/touching/dragging brings window immediately to front
  const highestZRef = useRef(30);
  const [zIndices, setZIndices] = useState<Record<string, number>>({
    'scope-1': 21,
    'gen-1': 22,
    'psu-1': 23,
    'dmm-1': 24,
    'measurements_board-1': 20,
    'board-1': 20,
  });

  const bringToFront = useCallback((instanceId: string) => {
    highestZRef.current += 1;
    const nextZ = highestZRef.current;
    setZIndices((prev) => ({
      ...prev,
      [instanceId]: nextZ,
    }));
  }, []);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Dragging ghost hologram preview state
  const [draggedCatalogType, setDraggedCatalogType] = useState<InstrumentType | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  // Dragging instrument state
  const draggingItemRef = useRef<{ id: string; startClientX: number; startClientY: number; origX: number; origY: number } | null>(null);

  // 2D Pan and Zoom Navigation State (Full-screen infinite engineering grid canvas)
  const [zoom, setZoom] = useState(() => loadSavedState('zoom', 0.65));
  const [pan, setPan] = useState(() => loadSavedState('pan', { x: 40, y: 40 }));
  // Live viewport: used for responsive fitting on phones, tablets and desktop
  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; origPanX: number; origPanY: number } | null>(null);
  const touchPinchRef = useRef<{ initialDistance: number; initialZoom: number } | null>(null);

  // Wiring System - Start clean with ZERO unwanted wires
  const [wires, setWires] = useState<Wire[]>(() => loadSavedState('wires', []));
  const [selectedWireColor, setSelectedWireColor] = useState<string>(() => loadSavedState('selectedWireColor', 'blue'));
  const [wiringSourcePort, setWiringSourcePort] = useState<Port | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [wiresVisible, setWiresVisible] = useState(() => loadSavedState('wiresVisible', true));
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Scope State (UNI-T UTD2102CEX+)
  const [scopeState, setScopeState] = useState<ScopeState>(loadSavedState('scopeState', {
    power: false,
    ch1: {
      enabled: true,
      voltsPerDiv: 1.0,
      position: 0,
      coupling: 'DC',
      probe: 1,
      invert: false,
      bwLimit: false,
      voltsFine: false,
    },
    ch2: {
      enabled: false,
      voltsPerDiv: 1.0,
      position: 0,
      coupling: 'DC',
      probe: 1,
      invert: false,
      bwLimit: false,
      voltsFine: false,
    },
    math: {
      enabled: false,
      mode: 'CH1+CH2',
      fftWindow: 'Hanning',
      fftUnit: 'Vrms',
    },
    timePerDiv: 500e-6,
    horizPosition: 0,
    trigger: {
      type: 'Edge',
      source: 'CH1',
      mode: 'AUTO',
      slope: 'rising',
      coupling: 'DC',
      level: 0,
      state: 'TRIGED',
      holdoff: 100e-9,
    },
    display: {
      format: 'YT',
      type: 'vectors',
      persist: 'off',
      brightness: 1.0,
    },
    acquire: {
      mode: 'sampling',
      averages: 16,
      fastAcq: false,
    },
    utility: {
      frequencyCounter: true,
      language: 'ar',
      gridBrightness: 0.85,
    },
    running: false,
    activeMenu: 'NONE',
    cursor: {
      enabled: false,
      type: 'time',
      source: 'CH1',
      activeCursor: 'A',
      c1: 0.35,
      c2: 0.65,
    },
    showAllParameters: false,
  }));

  // Function Generator State (LW-1641)
  const [genState, setGenState] = useState<FunctionGenState>(loadSavedState('genState', {
    power: false,
    frequency: 1000,
    range: 1000,
    freqDial: 1.0,
    fineDial: 0,
    waveform: 'sine',
    amplitude: 5.0,
    dcOffset: 0,
    symmetry: 0.5,
    attenuation: 0,
    inverted: false,
    ttlOut: true,
  }));

  // Power Supply State (ATTEN APS3005S)
  const [psuState, setPsuState] = useState<PowerSupplyState>(loadSavedState('psuState', {
    power: false,
    outputEnabled: false,
    voltageSet: 0,
    currentLimit: 0,
    voltageActual: 0,
    currentActual: 0,
    mode: 'CV',
  }));

  // Multimeter State (UNI-T UT33D+)
  const [dmmState, setDmmState] = useState<MultimeterState>(loadSavedState('dmmState', {
    power: false,
    mode: 'OFF',
    range: 'OFF',
    rangeId: 'OFF',
    hold: false,
    backlight: false,
    reading: 0,
    displayStr: '0.00',
    unit: 'V',
    overload: false,
  }));

  // Real-time Waveforms
  const [simResults, setSimResults] = useState<{
    ch1: SignalSample[];
    ch2: SignalSample[];
    activeCircuitName: string;
    cutoffFrequency?: number;
    gainDb?: number;
    phaseShiftDeg?: number;
  }>({
    ch1: [],
    ch2: [],
    activeCircuitName: 'Direct Connection',
  });

  // Training Board 1 (Electronics Training Board) state
  const [boardPot5k, setBoardPot5k] = useState<number>(() => loadSavedState('boardPot5k', 50));
  const [boardPot100k, setBoardPot100k] = useState<number>(() => loadSavedState('boardPot100k', 50));
  const [boardPot1M, setBoardPot1M] = useState<number>(() => loadSavedState('boardPot1M', 50));
  const [galvanometerCurrent, setGalvanometerCurrent] = useState<number>(() => loadSavedState('galvanometerCurrent', 0));

  // Training Board 2 (Instruments & Measurements Board) state
  const [measPot5k, setMeasPot5k] = useState<number>(() => loadSavedState('measPot5k', 50));
  const [measPot100k, setMeasPot100k] = useState<number>(() => loadSavedState('measPot100k', 50));
  const [measPot1M, setMeasPot1M] = useState<number>(() => loadSavedState('measPot1M', 50));
  const [microammeterCurrent, setMicroammeterCurrent] = useState<number>(() => loadSavedState('microammeterCurrent', 0));

  // Automatically save the complete bench session so it is restored on the next launch.
  useEffect(() => {
    try {
      const snapshot = {
        benchInstruments, wires, selectedWireColor, wiresVisible, zoom, pan,
        scopeState, genState, psuState, dmmState,
        boardPot5k, boardPot100k, boardPot1M, galvanometerCurrent,
        measPot5k, measPot100k, measPot1M, microammeterCurrent,
      };
      window.localStorage.setItem(LAB_SAVE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn('Could not save lab session:', error);
    }
  }, [
    benchInstruments, wires, selectedWireColor, wiresVisible, zoom, pan,
    scopeState, genState, psuState, dmmState,
    boardPot5k, boardPot100k, boardPot1M, galvanometerCurrent,
    measPot5k, measPot100k, measPot1M, microammeterCurrent,
  ]);



  // Audio Toggle
  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    labAudio.enabled = next;
  };

  // Add an instrument instance to workbench (Supports Drag & Drop with Drop Coordinates!)
  const handleAddInstrument = (type: InstrumentType, dropCoords?: { x: number; y: number }) => {
    labAudio.playPlugSnap();
    const count = benchInstruments.filter((i) => i.type === type).length;
    const newId = `${type}-${Date.now()}-${instCounterRef.current++}`;
    
    // Position instrument where dropped or neatly positioned along the bench if clicked
    const x = dropCoords !== undefined ? dropCoords.x : 2820 + count * 80;
    const y = dropCoords !== undefined ? dropCoords.y : 70;

    setBenchInstruments((prev) => [
      ...prev,
      {
        instanceId: newId,
        type,
        x,
        y,
      },
    ]);
    bringToFront(newId);
  };

  // Remove an instrument instance directly from bench
  const handleRemoveInstrument = (instanceId: string) => {
    labAudio.playButtonClick();
    setBenchInstruments((prev) => prev.filter((i) => i.instanceId !== instanceId));
    // Clean up attached wires
    setWires((prev) =>
      prev.filter((w) => !w.fromPortId.startsWith(`${instanceId}:`) && !w.toPortId.startsWith(`${instanceId}:`))
    );
    setSelectedWireId(null);
    setWiringSourcePort(null);
  };

  // Reset bench arrangement
  const handleResetBenchLayout = () => {
    labAudio.playButtonClick();
    setBenchInstruments(INITIAL_BENCH);
    setPan({ x: 0, y: 30 });
    setZoom(0.85);
  };

  // Dragging Handlers for Instruments (Pointer Events: mouse, touch & pen)
  const handleStartDrag = (instanceId: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(instanceId);
    const inst = benchInstruments.find((i) => i.instanceId === instanceId);
    if (!inst) return;

    setDraggingId(instanceId);
    draggingItemRef.current = {
      id: instanceId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: inst.x,
      origY: inst.y,
    };

    const isLead = inst.type === 'leads';
    const leadBncId = `${instanceId}:lead_bnc`;
    // Pulling an adapter off a jack un-docks it
    if (isLead) {
      setWires((prev) => prev.filter((w) => !(w.id.startsWith('dock-') && (w.fromPortId === leadBncId || w.toPortId === leadBncId))));
    }
    // Adapters docked on this device travel with it
    const followers: Array<{ id: string; origX: number; origY: number }> = [];
    if (!isLead) {
      for (const w of wires) {
        if (!w.id.startsWith('dock-')) continue;
        const other = w.fromPortId.startsWith(`${instanceId}:`) ? w.toPortId : w.toPortId.startsWith(`${instanceId}:`) ? w.fromPortId : null;
        if (!other || !other.endsWith(':lead_bnc')) continue;
        const leadId = other.slice(0, other.indexOf(':'));
        const li = benchInstruments.find((i) => i.instanceId === leadId);
        if (li) followers.push({ id: leadId, origX: li.x, origY: li.y });
      }
    }

    const handlePointerMove = (moveEvt: PointerEvent) => {
      const drag = draggingItemRef.current;
      if (!drag) return;
      const dx = (moveEvt.clientX - drag.startClientX) / zoom;
      const dy = (moveEvt.clientY - drag.startClientY) / zoom;
      const currentId = drag.id;

      setBenchInstruments((prev) =>
        prev.map((i) => {
          if (i.instanceId === currentId) return { ...i, x: drag.origX + dx, y: drag.origY + dy };
          const f = followers.find((fl) => fl.id === i.instanceId);
          return f ? { ...i, x: f.origX + dx, y: f.origY + dy } : i;
        })
      );
    };

    const handlePointerUp = () => {
      draggingItemRef.current = null;
      setDraggingId(null);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      if (isLead) {
        // Snap the BNC end onto the nearest free BNC jack
        window.requestAnimationFrame(() => {
          const mine = getPortCoord(leadBncId);
          if (!mine) return;
          let best: { port: Port; x: number; y: number; d: number } | null = null;
          for (const p of allBenchPorts) {
            if (p.type !== 'bnc' || p.parentId === instanceId) continue;
            const c = getPortCoord(p.id);
            if (!c) continue;
            const d = Math.hypot(c.x - mine.x, c.y - mine.y);
            if (d < 60 && (!best || d < best.d)) best = { port: p, x: c.x, y: c.y, d };
          }
          if (!best) return;
          const target = best;
          labAudio.playPlugSnap();
          setBenchInstruments((prev) => prev.map((i) => (i.instanceId === instanceId ? { ...i, x: i.x + (target.x - mine.x), y: i.y + (target.y - mine.y) } : i)));
          setWires((prev) => [
            ...prev.filter((w) => !(w.id.startsWith('dock-') && (w.fromPortId === leadBncId || w.toPortId === leadBncId))),
            { id: `dock-${Date.now()}-${wireCounterRef.current++}`, fromPortId: leadBncId, toPortId: target.port.id, color: 'black', type: 'bnc' },
          ]);
        });
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Canvas 2D Fluid Background Panning (Mouse)
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    // Don't pan if clicking an instrument, port, wire, or button
    if (target.closest('[data-instrument]') || target.closest('[data-port-id]') || target.closest('button')) {
      return;
    }
    if (e.button !== 0 && e.button !== 1) return;

    setIsPanning(true);
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
    };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!panStartRef.current) return;
      const dx = moveEvt.clientX - panStartRef.current.clientX;
      const dy = moveEvt.clientY - panStartRef.current.clientY;
      setPan({
        x: panStartRef.current.origPanX + dx,
        y: panStartRef.current.origPanY + dy,
      });
    };

    const handlePointerUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Touch Support (Single Finger Drag to Pan, Two-Finger Pinch to Zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-instrument]') || target.closest('[data-port-id]') || target.closest('button')) {
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsPanning(true);
      panStartRef.current = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      };
    } else if (e.touches.length === 2) {
      setIsPanning(false);
      panStartRef.current = null;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchPinchRef.current = {
        initialDistance: dist,
        initialZoom: zoom,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && panStartRef.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - panStartRef.current.clientX;
      const dy = touch.clientY - panStartRef.current.clientY;
      setPan({
        x: panStartRef.current.origPanX + dx,
        y: panStartRef.current.origPanY + dy,
      });
    } else if (e.touches.length === 2 && touchPinchRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / Math.max(touchPinchRef.current.initialDistance, 1);
      const newZoom = Math.min(1.5, Math.max(0.18, touchPinchRef.current.initialZoom * ratio));
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsPanning(false);
      panStartRef.current = null;
      touchPinchRef.current = null;
    } else if (e.touches.length === 1) {
      touchPinchRef.current = null;
      const touch = e.touches[0];
      panStartRef.current = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      };
    }
  };

  // Native non-passive wheel listener. React's onWheel is registered as a
  // passive listener, so preventDefault() there floods the console with
  // "Unable to preventDefault inside passive event listener" errors.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom((prev) => Math.min(1.5, Math.max(0.18, Number((prev * zoomFactor).toFixed(3)))));
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, []);

  // Zoom In button (+15%)
  const handleZoomIn = () => {
    labAudio.playButtonClick();
    setZoom((prev) => Math.min(1.5, Number((prev * 1.15).toFixed(2))));
  };

  // Zoom Out button (-15%, down to 0.18)
  const handleZoomOut = () => {
    labAudio.playButtonClick();
    setZoom((prev) => Math.max(0.18, Number((prev * 0.85).toFixed(2))));
  };

  // Fit every instrument currently on the bench (works for any aspect ratio)
  const handleFitView = () => {
    labAudio.playButtonClick();
    if (benchInstruments.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const inst of benchInstruments) {
      const meta = INSTRUMENT_METADATA[inst.type];
      minX = Math.min(minX, inst.x);
      minY = Math.min(minY, inst.y);
      maxX = Math.max(maxX, inst.x + meta.w);
      maxY = Math.max(maxY, inst.y + meta.h);
    }
    const vw = viewport.w || window.innerWidth;
    const vh = viewport.h || window.innerHeight;
    const fitZoom = Math.max(
      0.12,
      Math.min(1.05, Math.min((vw - 40) / Math.max(maxX - minX, 1), (vh - 130) / Math.max(maxY - minY, 1)))
    );
    const z = Number(fitZoom.toFixed(3));
    setZoom(z);
    setPan({ x: 20 - minX * z, y: 20 - minY * z });
  };

  // Jump/zoom straight to one instrument — ideal on phones and tablets
  const focusInstrument = useCallback((instanceId: string) => {
    const inst = benchInstruments.find((i) => i.instanceId === instanceId);
    if (!inst) return;
    const meta = INSTRUMENT_METADATA[inst.type];
    const vw = viewport.w || window.innerWidth;
    const vh = viewport.h || window.innerHeight;
    const z = Number(Math.max(0.18, Math.min(1.1, Math.min((vw - 28) / meta.w, (vh - 150) / meta.h))).toFixed(3));
    setZoom(z);
    setPan({ x: 14 - inst.x * z, y: 14 - inst.y * z });
  }, [benchInstruments, viewport]);

  // Reset View to default view
  const handleResetView = () => {
    labAudio.playButtonClick();
    setPan({ x: 40, y: 40 });
    setZoom(0.65);
  };

  // Compute Port Coordinate relative to workbench container with center-pin precision
  const getPortCoord = useCallback((portId: string): { x: number; y: number } | null => {
    if (!workbenchRef.current) return null;
    const el = workbenchRef.current.querySelector<HTMLElement>(`[data-port-id="${portId}"]`);
    if (!el) return null;

    const wbRect = workbenchRef.current.getBoundingClientRect();
    // Measure the visual socket itself (not the wrapper, which also contains the
    // text label under the jack) so the plug lands exactly in the hole centre.
    const anchor = el.querySelector<HTMLElement>('[data-port-anchor]') ?? el;
    const portRect = anchor.getBoundingClientRect();

    return {
      x: (portRect.left + portRect.width / 2 - wbRect.left) / zoom,
      y: (portRect.top + portRect.height / 2 - wbRect.top) / zoom,
    };
  }, [zoom]);

  // Stacking layer of the instrument that owns a port. Instruments use even
  // z-indices (z*2); a wire sits one above the highest of its two devices, so it
  // is hidden by any device placed on top of it instead of floating over everything.
  const getPortLayer = useCallback((portId: string): number => {
    const inst = benchInstruments.find((i) => portId === i.instanceId || portId.startsWith(`${i.instanceId}:`));
    if (!inst) return 20 * 2;
    if (draggingId === inst.instanceId) return 2000;
    return (zIndices[inst.instanceId] ?? 20) * 2;
  }, [benchInstruments, zIndices, draggingId]);

  // Port Click to Connect Wire (Seamless stacking, zero annoying toasts, no automatic error badge)
  const handlePortClick = (port: Port) => {
    if (!wiringSourcePort) {
      setWiringSourcePort(port);
      return;
    }

    if (wiringSourcePort.id === port.id) {
      // Tapping same port cancels starting wire cleanly
      setWiringSourcePort(null);
      return;
    }

    const alreadyWired = wires.some(
      (w) =>
        (w.fromPortId === wiringSourcePort.id && w.toPortId === port.id) ||
        (w.fromPortId === port.id && w.toPortId === wiringSourcePort.id)
    );
    if (alreadyWired) {
      labAudio.playButtonClick();
      setWiringSourcePort(null);
      return;
    }

    const isBncConnection = wiringSourcePort.type === 'bnc' && port.type === 'bnc';
    const isBncToBanana =
      (wiringSourcePort.type === 'bnc' && port.type === 'banana') ||
      (wiringSourcePort.type === 'banana' && port.type === 'bnc');

    const newWire: Wire = {
      id: `wire-${Date.now()}-${wireCounterRef.current++}`,
      fromPortId: wiringSourcePort.id,
      toPortId: port.id,
      color: selectedWireColor,
      type: isBncConnection ? 'bnc' : isBncToBanana ? 'bnc-banana' : 'banana',
    };

    labAudio.playPlugSnap();
    setWires((prev) => [...prev, newWire]);
    setWiringSourcePort(null);
    // Keep selectedWireId null so NO red X badge appears on the new wire!
    setSelectedWireId(null);
  };

  const handleRemoveWire = (wireId: string) => {
    labAudio.playPlugSnap();
    setWires((prev) => prev.filter((w) => w.id !== wireId));
    setSelectedWireId(null);
  };

  // Unplug every lead sharing one jack (meter tap, parallel branch, ...)
  const handleRemoveWiresAtPort = (portId: string) => {
    labAudio.playPlugSnap();
    setWires((prev) => prev.filter((w) => w.fromPortId !== portId && w.toPortId !== portId));
    setSelectedWireId(null);
  };

  const handleClearWires = () => {
    labAudio.playButtonClick();
    setWires([]);
    setWiringSourcePort(null);
    setSelectedWireId(null);
  };

  // Completely clear the workbench (devices, leads and temporary selections).
  const handleClearAll = () => {
    if (!window.confirm('حذف تام؟ سيتم حذف جميع الأجهزة والأسلاك من الطاولة.')) return;
    labAudio.playButtonClick();
    setBenchInstruments([]);
    setWires([]);
    setWiringSourcePort(null);
    setSelectedWireId(null);
    setDraggingId(null);
    setZIndices({});
    setPan({ x: 40, y: 40 });
    setZoom(0.65);
    setScopeState((prev) => ({ ...prev, power: false, running: false, activeMenu: 'NONE' }));
    setGenState((prev) => ({ ...prev, power: false, amplitude: 5, dcOffset: 0, frequency: 1000, range: 1000, freqDial: 1, fineDial: 0, waveform: 'sine', symmetry: 0.5, attenuation: 0, inverted: false, ttlOut: true }));
    setPsuState((prev) => ({ ...prev, power: false, outputEnabled: false, voltageSet: 12, currentLimit: 1, voltageActual: 12, currentActual: 0, mode: 'CV' }));
    setDmmState((prev) => ({ ...prev, power: false, mode: 'OFF', range: 'OFF', rangeId: 'OFF', hold: false, backlight: false, reading: 0, displayStr: '0.00', unit: 'V', overload: false }));
    setBoardPot5k(50); setBoardPot100k(50); setBoardPot1M(50);
    setMeasPot5k(50); setMeasPot100k(50); setMeasPot1M(50);
    setGalvanometerCurrent(0); setMicroammeterCurrent(0);
    instCounterRef.current += 1;
    wireCounterRef.current += 1;
  };


  // Mouse Move for live wire drawing preview
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!workbenchRef.current) return;
    const wbRect = workbenchRef.current.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - wbRect.left) / zoom,
      y: (e.clientY - wbRect.top) / zoom,
    });
  };

  // Responsive viewport tracking (phones / tablets / desktop, both orientations)
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // First load: centre the scope on small screens instead of showing empty grid
  const didInitViewRef = useRef(false);
  useEffect(() => {
    if (didInitViewRef.current) return;
    didInitViewRef.current = true;
    const vw = window.innerWidth;
    if (vw < 1100) {
      const inst = benchInstruments[0];
      if (!inst) return;
      const meta = INSTRUMENT_METADATA[inst.type];
      const z = Number(Math.max(0.2, Math.min(0.9, (vw - 24) / meta.w)).toFixed(3));
      setZoom(z);
      setPan({ x: 12 - inst.x * z, y: 12 - inst.y * z });
    }
  }, [benchInstruments]);

  // Keyboard shortcuts: Esc cancels wiring, Delete removes the selected wire
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        setWiringSourcePort(null);
        setSelectedWireId(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWireId) {
        e.preventDefault();
        handleRemoveWire(selectedWireId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedWireId]);

  // Real-time Circuit Simulation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      // Pre-trigger window so that the waveform fills all 10 divisions from left to right
      const preTriggerSpan = 10 * scopeState.timePerDiv;
      const totalSpan = 30 * scopeState.timePerDiv;
      const numPoints = 650;

      const results = solveActiveCircuit({
        wires,
        gen: genState,
        psu: psuState,
        scope: scopeState,
        boardValues: {
          pot5k: boardPot5k,
          pot100k: boardPot100k,
          pot1M: boardPot1M,
          POT_5k: boardPot5k,
          POT_100k: boardPot100k,
          POT_1M: boardPot1M,
          POT_10k: boardPot5k,
          measPot5k,
          measPot100k,
          measPot1M,
        },
        multimeterMode: dmmState.mode,
        timeWindow: {
          start: -preTriggerSpan + scopeState.horizPosition,
          duration: totalSpan,
          numPoints,
        },
      });

      // Update Oscilloscope waveforms
      setSimResults({
        ch1: results.scopeCh1Waveform,
        ch2: results.scopeCh2Waveform,
        activeCircuitName: results.circuitInfo.activeCircuitName,
        cutoffFrequency: results.circuitInfo.cutoffFrequency,
        gainDb: results.circuitInfo.gainDb,
        phaseShiftDeg: results.circuitInfo.phaseShiftDeg,
      });

      // Update Galvanometer needle current and Microammeter current
      setGalvanometerCurrent(results.galvanometerCurrent);
      setMicroammeterCurrent(results.microammeterCurrent ?? 0);

      // Update Power Supply actual voltage and current
      setPsuState((prev) => ({
        ...prev,
        voltageActual: results.psuActualVoltage,
        currentActual: results.psuActualCurrent,
        mode: results.psuMode,
      }));

      // Update Multimeter reading
      if (!dmmState.hold) {
        setDmmState((prev) => ({
          ...prev,
          reading: results.dmmReading,
          unit: results.dmmUnit,
        }));
      }
    }, 45);

    return () => clearInterval(interval);
  }, [wires, genState, psuState, scopeState, dmmState.mode, dmmState.hold, boardPot5k, boardPot100k, boardPot1M, measPot5k, measPot100k, measPot1M]);

  const allBenchPorts = useMemo(() => {
    return benchInstruments.flatMap((inst) => getPortsForInstance(inst.instanceId, inst.type) ?? []).filter(Boolean);
  }, [benchInstruments]);

  const connectedPortIds = useMemo(() => {
    return new Set(wires.flatMap((w) => [w.fromPortId, w.toPortId]));
  }, [wires]);

  // How many leads sit on each jack (supports unlimited parallel stacking)
  const portConnectionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of wires) {
      map.set(w.fromPortId, (map.get(w.fromPortId) ?? 0) + 1);
      map.set(w.toPortId, (map.get(w.toPortId) ?? 0) + 1);
    }
    return map;
  }, [wires]);

  return (
    <div
      className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-[#060910] text-slate-100 select-none"
      onPointerUp={(e) => {
        if (e.target === e.currentTarget && wiringSourcePort) {
          setWiringSourcePort(null);
        }
      }}
    >
      {/* Top Application Toolbar */}
      <Toolbar
        onOpenDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
        isDrawerOpen={isDrawerOpen}
        wireColor={selectedWireColor}
        onSelectWireColor={setSelectedWireColor}
        wiresVisible={wiresVisible}
        onToggleWires={() => setWiresVisible(!wiresVisible)}
        onClearWires={handleClearWires}
        onClearAll={handleClearAll}
        onResetView={handleResetView}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        audioEnabled={audioEnabled}
        onToggleAudio={handleToggleAudio}
      />

      {/* Main Laboratory Workbench Canvas (Fluid 2D Pan & Zoom, Drag & Drop Support) */}
      <main
        ref={mainRef}
        onPointerDown={handleCanvasPointerDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseMove={handleMouseMove}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (!workbenchRef.current) return;
          const rawType = (draggedCatalogType || e.dataTransfer.getData('application/lab-instrument') || '') as InstrumentType;
          const wbRect = workbenchRef.current.getBoundingClientRect();
          const currentX = (e.clientX - wbRect.left) / zoom;
          const currentY = (e.clientY - wbRect.top) / zoom;
          setGhostPos({ x: currentX, y: currentY });
          if (!draggedCatalogType && rawType in INSTRUMENT_METADATA) {
            setDraggedCatalogType(rawType);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) {
            setGhostPos(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rawType = (e.dataTransfer.getData('application/lab-instrument') || e.dataTransfer.getData('text/plain') || draggedCatalogType) as InstrumentType;
          setGhostPos(null);
          setDraggedCatalogType(null);
          const type = rawType?.trim() as InstrumentType;
          if (!type || !(type in INSTRUMENT_METADATA)) return;
          if (!workbenchRef.current) return;
          const wbRect = workbenchRef.current.getBoundingClientRect();
          const dropX = (e.clientX - wbRect.left) / zoom;
          const dropY = (e.clientY - wbRect.top) / zoom;
          const meta = INSTRUMENT_METADATA[type];
          const targetX = Math.round(dropX - (meta?.w || 500) / 2);
          const targetY = Math.round(dropY - (meta?.h || 400) / 2);
          handleAddInstrument(type, { x: targetX, y: targetY });
        }}
        className={`flex-1 min-h-0 overflow-hidden relative select-none w-full h-full ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          touchAction: 'none',
          overscrollBehavior: 'none',
          backgroundColor: '#070b13',
          backgroundImage: `
            linear-gradient(to right, rgba(56, 189, 248, 0.18) 1.5px, transparent 1.5px),
            linear-gradient(to bottom, rgba(56, 189, 248, 0.18) 1.5px, transparent 1.5px),
            linear-gradient(to right, rgba(56, 189, 248, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56, 189, 248, 0.05) 1px, transparent 1px)
          `,
          backgroundPosition: `
            ${pan.x}px ${pan.y}px,
            ${pan.x}px ${pan.y}px,
            ${pan.x}px ${pan.y}px,
            ${pan.x}px ${pan.y}px
          `,
          backgroundSize: `
            ${100 * zoom}px ${100 * zoom}px,
            ${100 * zoom}px ${100 * zoom}px,
            ${20 * zoom}px ${20 * zoom}px,
            ${20 * zoom}px ${20 * zoom}px
          `,
        }}
      >
        {/* Full-Page Infinite Workbench Layer (No bounding cards, no black void, scales with zoom) */}
        <div
          ref={workbenchRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            // Absolute-positioned instruments do not contribute to their parent's
            // intrinsic size. Give the workbench a real canvas so the SVG wire
            // overlay has a non-zero drawing surface across the whole workspace.
            width: 12000,
            height: 9000,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: 'none',
          }}
          className="overflow-visible select-none pointer-events-auto"
        >
          {/* Wire SVG Overlay Layer */}
          <WireOverlay
            wires={wires.filter((w) => !w.id.startsWith('dock-'))}
            ports={allBenchPorts}
            wiringSourcePort={wiringSourcePort}
            mousePos={mousePos}
            activeColor={selectedWireColor}
            visible={wiresVisible}
            selectedWireId={selectedWireId}
            onSelectWire={setSelectedWireId}
            onRemoveWire={handleRemoveWire}
            onRemoveWiresAtPort={handleRemoveWiresAtPort}
            getPortCoord={getPortCoord}
            getPortLayer={getPortLayer}
          />

          {/* Ghost Holographic Preview following mouse on drag ("طيف الجهاز") */}
          {ghostPos && draggedCatalogType && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: `${INSTRUMENT_METADATA[draggedCatalogType]?.w || 500}px`,
                height: `${INSTRUMENT_METADATA[draggedCatalogType]?.h || 400}px`,
                transform: `translate(${Math.round(ghostPos.x - (INSTRUMENT_METADATA[draggedCatalogType]?.w || 500) / 2)}px, ${Math.round(ghostPos.y - (INSTRUMENT_METADATA[draggedCatalogType]?.h || 400) / 2)}px)`,
                pointerEvents: 'none',
                zIndex: 3000,
              }}
              className="rounded-2xl border-2 border-dashed border-cyan-400 bg-cyan-950/45 backdrop-blur-sm shadow-[0_0_40px_rgba(6,182,212,0.4)] flex flex-col items-center justify-between p-4 text-cyan-200 animate-pulse font-arabic select-none transition-none"
            >
              {/* Top Hologram Strip */}
              <div className="w-full flex items-center justify-between border-b border-cyan-400/30 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-ping" />
                  <span className="font-mono text-xs font-black tracking-widest uppercase text-cyan-300">
                    [ طيف الجهاز ] {INSTRUMENT_METADATA[draggedCatalogType]?.titleEn}
                  </span>
                </div>
                <span className="text-xs font-bold text-cyan-200">
                  {INSTRUMENT_METADATA[draggedCatalogType]?.titleAr}
                </span>
              </div>

              {/* Center Reticle Target */}
              <div className="flex flex-col items-center justify-center gap-2 my-auto">
                <div className="w-16 h-16 rounded-full border border-cyan-400/60 flex items-center justify-center relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
                  <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-cyan-400/50" />
                  <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-cyan-400/50" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-black text-white drop-shadow">
                    أفلت هنا لتثبيت الجهاز على الطاولة
                  </div>
                  <div className="text-[10px] font-mono text-cyan-300">
                    X: {Math.round(ghostPos.x)}px | Y: {Math.round(ghostPos.y)}px
                  </div>
                </div>
              </div>

              {/* Bottom Footer Info */}
              <div className="w-full flex items-center justify-between border-t border-cyan-400/30 pt-2 text-[10px] font-mono text-cyan-400/80">
                <span>DIMENSIONS: {INSTRUMENT_METADATA[draggedCatalogType]?.w} × {INSTRUMENT_METADATA[draggedCatalogType]?.h} px</span>
                <span>RELEASE TO DROP • أفلت للإنزال</span>
              </div>
            </div>
          )}

          {/* Instruments Layer - Absolute Canvas Positioning (No items jump or disappear) */}
          {benchInstruments.map((inst) => {
            const instPorts = getPortsForInstance(inst.instanceId, inst.type);
            const isDragging = draggingId === inst.instanceId;
            const hasCh1Wire = connectedPortIds.has(`${inst.instanceId}:ch1`);
            const hasCh2Wire = connectedPortIds.has(`${inst.instanceId}:ch2`);

            return (
              <div
                key={inst.instanceId}
                data-instrument={inst.type}
                onPointerDownCapture={() => bringToFront(inst.instanceId)}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  transform: `translate(${inst.x}px, ${inst.y}px)`,
                  zIndex: isDragging ? 2000 : (zIndices[inst.instanceId] ?? 20) * 2,
                }}
                className="transition-none select-none"
              >
                {inst.type === 'scope' && (
                  <Oscilloscope
                    state={scopeState}
                    ch1Waveform={hasCh1Wire ? simResults.ch1 : []}
                    ch2Waveform={hasCh2Wire ? simResults.ch2 : []}
                    onStateChange={setScopeState}
                    ports={instPorts}
                    connectedPortIds={connectedPortIds}
                    wiringSourcePort={wiringSourcePort}
                    onPortClick={handlePortClick}
                    onClose={() => handleRemoveInstrument(inst.instanceId)}
                    onDragStart={(e) => handleStartDrag(inst.instanceId, e)}
                  />
                )}

                {inst.type === 'gen' && (
                  <FunctionGenerator
                    state={genState}
                    onStateChange={setGenState}
                    ports={instPorts}
                    connectedPortIds={connectedPortIds}
                    wiringSourcePort={wiringSourcePort}
                    onPortClick={handlePortClick}
                    onClose={() => handleRemoveInstrument(inst.instanceId)}
                    onDragStart={(e) => handleStartDrag(inst.instanceId, e)}
                  />
                )}


                {inst.type === 'psu' && (
                  <PowerSupply
                    state={psuState}
                    onStateChange={setPsuState}
                    ports={instPorts}
                    connectedPortIds={connectedPortIds}
                    wiringSourcePort={wiringSourcePort}
                    onPortClick={handlePortClick}
                    onClose={() => handleRemoveInstrument(inst.instanceId)}
                    onDragStart={(e) => handleStartDrag(inst.instanceId, e)}
                  />
                )}

                {inst.type === 'dmm' && (
                  <Multimeter
                    state={dmmState}
                    onStateChange={setDmmState}
                    ports={instPorts}
                    connectedPortIds={connectedPortIds}
                    wiringSourcePort={wiringSourcePort}
                    onPortClick={handlePortClick}
                    onClose={() => handleRemoveInstrument(inst.instanceId)}
                    onDragStart={(e) => handleStartDrag(inst.instanceId, e)}
                  />
                )}

                {inst.type === 'board' && (
                  <TrainingBoard
                    instanceId={inst.instanceId}
                    ports={instPorts}
                    connectedPortIds={connectedPortIds}
                    wiringSourcePort={wiringSourcePort}
                    onPortClick={handlePortClick}
                    onClose={() => handleRemoveInstrument(inst.instanceId)}
                    onDragStart={(e) => handleStartDrag(inst.instanceId, e)}
                    galvanometerDeflection={galvanometerCurrent}
                    pot5k={boardPot5k}
                    pot100k={boardPot100k}
                    pot1M={boardPot1M}
                    onPotChange={(k, v) => {
                      if (k === 'pot5k') setBoardPot5k(v);
                      if (k === 'pot100k') setBoardPot100k(v);
                      if (k === 'pot1M') setBoardPot1M(v);
                    }}
                    portConnectionCounts={portConnectionCounts}
                  />
                )}

                {inst.type === 'measurements_board' && (
                  <MeasurementsBoard
                    instanceId={inst.instanceId}
                    ports={instPorts}
                    connectedPortIds={connectedPortIds}
                    wiringSourcePort={wiringSourcePort}
                    onPortClick={handlePortClick}
                    onClose={() => handleRemoveInstrument(inst.instanceId)}
                    onDragStart={(e) => handleStartDrag(inst.instanceId, e)}
                    meterDeflection={microammeterCurrent}
                    pot5k={measPot5k}
                    pot100k={measPot100k}
                    pot1M={measPot1M}
                    onPotChange={(k, v) => {
                      if (k === 'pot5k') setMeasPot5k(v);
                      if (k === 'pot100k') setMeasPot100k(v);
                      if (k === 'pot1M') setMeasPot1M(v);
                    }}
                    portConnectionCounts={portConnectionCounts}
                  />
                )}

                {inst.type === 'leads' && (
                  <BananaLeads
                    ports={instPorts}
                    connectedPortIds={connectedPortIds}
                    wiringSourcePort={wiringSourcePort}
                    onPortClick={handlePortClick}
                    onClose={() => handleRemoveInstrument(inst.instanceId)}
                    onDragStart={(e) => handleStartDrag(inst.instanceId, e)}
                  />
                )}

                {inst.type === 'filterboard' && (
                  <FilterBoard
                    instanceId={inst.instanceId}
                    ports={instPorts}
                    connectedPortIds={connectedPortIds}
                    wiringSourcePort={wiringSourcePort}
                    onPortClick={handlePortClick}
                    onClose={() => handleRemoveInstrument(inst.instanceId)}
                    onDragStart={(e) => handleStartDrag(inst.instanceId, e)}
                    portConnectionCounts={portConnectionCounts}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Workbench main area */}
      </main>

      {/* Equipment Drawer (Slide-in from left with smooth 60fps animation & drag-and-drop) */}
      <InstrumentDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onAddInstrument={(type, dropCoords) => handleAddInstrument(type as InstrumentType, dropCoords)}
        onDragStartItem={(type) => setDraggedCatalogType(type as InstrumentType)}
        onDragEndItem={() => {
          setDraggedCatalogType(null);
          setGhostPos(null);
        }}
      />
    </div>
  );
}
