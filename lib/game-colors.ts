import type {CSSProperties} from 'react';
type GameColor={id:string;color:string};
const hues:Record<string,number>={teal:165,blue:215,violet:275,orange:32,rose:335};
export function gameStyle(game:GameColor,games:GameColor[]):CSSProperties{
 const used:number[]=[];let hue=hues[game.color]??165;
 for(const g of games){let h=hues[g.color]??165;const separation=(candidate:number)=>used.length?Math.min(...used.map(v=>Math.min(Math.abs(candidate-v),360-Math.abs(candidate-v)))):360;if(separation(h)<25){let best=h;for(let candidate=0;candidate<360;candidate++)if(separation(candidate)>separation(best))best=candidate;h=best;}used.push(h);if(g.id===game.id){hue=h;break;}}
 return {'--game-hue':hue} as CSSProperties;
}
