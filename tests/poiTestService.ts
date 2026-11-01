import {POITrustService} from '../src/ts/poiTrustContext';
import {MemoryPOIObservedHistory} from '../src/ts/poiObservedHistory';
export class TestPOITrustService extends POITrustService {
    public constructor(store:ConstructorParameters<typeof POITrustService>[0],keys:ConstructorParameters<typeof POITrustService>[1],now?:()=>number,history=new MemoryPOIObservedHistory()){super(store,keys,now,history);}
}
