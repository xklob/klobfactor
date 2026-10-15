// Match Blender's Preserve Volume armature deformation. Ordinary linear
// skinning collapses a wrist when its influencing bones rotate against each
// other. Dual quaternions blend rigid rotations without losing the cross-section.
import * as T from 'three';

const definitions = `
uniform sampler2D volumeBones;
vec3 volumeRotate(vec4 q, vec3 p) {
  return p + 2.0 * cross(q.xyz, cross(q.xyz, p) + q.w * p);
}
vec4 volumeMultiply(vec4 a, vec4 b) {
  return vec4(a.w*b.xyz + b.w*a.xyz + cross(a.xyz,b.xyz), a.w*b.w-dot(a.xyz,b.xyz));
}
`;
const blend = `
#ifdef USE_SKINNING
  vec4 vr0 = texelFetch(volumeBones, ivec2(0, int(skinIndex.x)), 0);
  vec4 vr1 = texelFetch(volumeBones, ivec2(0, int(skinIndex.y)), 0);
  vec4 vr2 = texelFetch(volumeBones, ivec2(0, int(skinIndex.z)), 0);
  vec4 vr3 = texelFetch(volumeBones, ivec2(0, int(skinIndex.w)), 0);
  vec4 vw = skinWeight * vec4(1.0, dot(vr0,vr1)<0.0?-1.0:1.0,
    dot(vr0,vr2)<0.0?-1.0:1.0, dot(vr0,vr3)<0.0?-1.0:1.0);
  vec4 volumeReal = vr0*vw.x + vr1*vw.y + vr2*vw.z + vr3*vw.w;
  vec4 volumeDual = texelFetch(volumeBones, ivec2(1,int(skinIndex.x)),0)*vw.x
    + texelFetch(volumeBones, ivec2(1,int(skinIndex.y)),0)*vw.y
    + texelFetch(volumeBones, ivec2(1,int(skinIndex.z)),0)*vw.z
    + texelFetch(volumeBones, ivec2(1,int(skinIndex.w)),0)*vw.w;
  float volumeLength = length(volumeReal);
  volumeReal /= volumeLength;
  volumeDual /= volumeLength;
  volumeDual -= volumeReal * dot(volumeReal, volumeDual);
#endif
`;
const position = `
#ifdef USE_SKINNING
  vec3 vp = (bindMatrix * vec4(transformed,1.0)).xyz;
  vec3 vt = 2.0 * volumeMultiply(volumeDual,vec4(-volumeReal.xyz,volumeReal.w)).xyz;
  transformed = (bindMatrixInverse * vec4(volumeRotate(volumeReal,vp)+vt,1.0)).xyz;
#endif
`;
const normal = `
#ifdef USE_SKINNING
  objectNormal = mat3(bindMatrixInverse) * volumeRotate(volumeReal, mat3(bindMatrix)*objectNormal);
  #ifdef USE_TANGENT
    objectTangent = mat3(bindMatrixInverse) * volumeRotate(volumeReal, mat3(bindMatrix)*objectTangent);
  #endif
#endif
`;

export function preserveVolume(actor) {
  const states = new Map();
  const matrix = new T.Matrix4(), q = new T.Quaternion(), d = new T.Quaternion(), translation = new T.Vector3();
  const real = new T.Quaternion(), dual = new T.Quaternion(), item = new T.Quaternion(), conjugate = new T.Quaternion();
  actor.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const skeleton = mesh.skeleton;
    let state = states.get(skeleton);
    if (!state) {
      const data = new Float32Array(skeleton.bones.length * 8);
      const texture = new T.DataTexture(data, 2, skeleton.bones.length, T.RGBAFormat, T.FloatType);
      texture.needsUpdate = true;
      state = {skeleton, data, texture};
      states.set(skeleton, state);
    }
    const patch = material => {
      material.onBeforeCompile = shader => {
        shader.uniforms.volumeBones = {value: state.texture};
        shader.vertexShader = shader.vertexShader
          .replace('#include <skinning_pars_vertex>', '#include <skinning_pars_vertex>\n' + definitions)
          .replace('#include <skinbase_vertex>', blend)
          .replace('#include <skinning_vertex>', position)
          .replace('#include <skinnormal_vertex>', normal);
      };
      material.customProgramCacheKey = () => 'blender-preserve-volume-1';
      return material;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => patch(m.clone())) : patch(mesh.material.clone());
    mesh.customDepthMaterial = patch(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}));
    mesh.customDistanceMaterial = patch(new T.MeshDistanceMaterial());
    // Ray picking and the surface audit must inspect the same deformation as
    // the renderer, including fingernails and thumb contact triangles.
    mesh.applyBoneTransform = (index, point) => {
      const ids = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight, data = state.data;
      const first = ids.getComponent(index, 0) * 8;
      q.fromArray(data, first);real.set(0,0,0,0);dual.set(0,0,0,0);
      for (let k=0;k<4;k++) {
        const offset=ids.getComponent(index,k)*8;
        item.fromArray(data,offset);
        const w=weights.getComponent(index,k)*(q.dot(item)<0?-1:1);
        real.x+=item.x*w;real.y+=item.y*w;real.z+=item.z*w;real.w+=item.w*w;
        dual.x+=data[offset+4]*w;dual.y+=data[offset+5]*w;dual.z+=data[offset+6]*w;dual.w+=data[offset+7]*w;
      }
      const scale=real.length();real.normalize();dual.set(dual.x/scale,dual.y/scale,dual.z/scale,dual.w/scale);
      const dot=real.dot(dual);dual.set(dual.x-real.x*dot,dual.y-real.y*dot,dual.z-real.z*dot,dual.w-real.w*dot);
      conjugate.copy(real).conjugate();item.copy(dual).multiply(conjugate);
      point.applyMatrix4(mesh.bindMatrix).applyQuaternion(real);
      point.x+=2*item.x;point.y+=2*item.y;point.z+=2*item.z;
      return point.applyMatrix4(mesh.bindMatrixInverse);
    };
  });
  return () => {
    actor.updateMatrixWorld(true);
    for (const {skeleton,data,texture} of states.values()) {
      skeleton.update();
      for(let i=0;i<skeleton.bones.length;i++){
        matrix.fromArray(skeleton.boneMatrices,i*16);q.setFromRotationMatrix(matrix).normalize();
        translation.setFromMatrixPosition(matrix);d.set(translation.x,translation.y,translation.z,0).multiply(q);
        q.toArray(data,i*8);data[i*8+4]=d.x*.5;data[i*8+5]=d.y*.5;data[i*8+6]=d.z*.5;data[i*8+7]=d.w*.5;
      }
      texture.needsUpdate=true;
    }
  };
}
