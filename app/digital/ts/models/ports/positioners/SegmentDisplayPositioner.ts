import {V} from "Vector";

import {InputPort} from "../InputPort";

import {IO_PORT_RADIUS} from "core/utils/Constants";

export class SegmentDisplayPositioner {

    /**
     * Port positiong for segment displays for different inputs
     *
     * @param arr The array of ports (either in or out ports)
     */
    public updatePortPositions(ports: Array<InputPort>): void {
        ports.forEach((port, i) => {
            // Calculate y position of port
            const size = port.getParent().getSize();
            const l = -(2*IO_PORT_RADIUS+1)*(i - ports.length/2 + 0.5);

            // Set y positions
            port.setOriginPos(V(-(size.x - 2)/2, l));
            port.setTargetPos(V(port.getTargetPos().x, l));
        });
    }
}
