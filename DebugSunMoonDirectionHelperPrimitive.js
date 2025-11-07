const {
  Cartesian3,
  Transforms,
  Matrix3,
  Matrix4,
  Color,
  PolylineGeometry,
  ArcType,
  GeometryInstance,
  Math: CesiumMath,
  destroyObject,
  RenderState,
  Primitive,
  PolylineColorAppearance,
  LabelCollection,
  BillboardCollection,
  Material,
  PolylineCollection,
  PrimitiveCollection,
  PolylineMaterialAppearance,
  DepthFunction,
  Texture,
  Framebuffer,
  BoundingRectangle,
} = Cesium;


/**
 * Used to quickly locate the sun and moon in the sky.
 * Note that this is relatively performance-intensive, unoptimized, and intended for debugging purposes only.
 * @example
 * const debugSunAndMoonDirectionPrimitive = viewer.scene.primitives.add(new Cesium.DebugSunAndMoonDirectionPrimitive());
 * 
 * debugSunAndMoonDirectionPrimitive.show = false;
 * 
 * viewer.scene.primitives.remove(debugSunAndMoonDirectionPrimitive)
 */
function DebugSunAndMoonDirectionPrimitive() {
  this.primitives = new PrimitiveCollection({
    destroyPrimitives: true
  });

  const labelCollection = new LabelCollection();
  labelCollection.add({
    position: new Cartesian3(1, 1, 1),
    text: 'East',
    scale: 0.6,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  });
  labelCollection.add({
    position: new Cartesian3(1, 1, 1),
    text: 'North',
    scale: 0.6,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  });
  labelCollection.add({
    position: new Cartesian3(1, 1, 1),
    text: 'Up',
    scale: 0.6,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  });
  this.labelCollection = labelCollection;

  this.sunSpriteImage = undefined;
  this.moonSpriteImage = undefined;
  this.billboards = new BillboardCollection();

  /**
   * Determines if the primitive will be shown.
   * @type {boolean}
   * @default {true}
   */
  this.show = true;
}

let disableDepthTestDepthWriteRenderStateScratch;
function createModelMatrixPrimitive(modelMatrix, width = 10) {
  const xPrimitive = createPolylinePrimitive([new Cartesian3(-1, 0, 0), Cartesian3.UNIT_X], Color.RED, width, modelMatrix);
  const yPrimitive = createPolylinePrimitive([new Cartesian3(0, -1, 0), Cartesian3.UNIT_Y], Color.GREEN, width, modelMatrix);
  const zPrimitive = createPolylinePrimitive([Cartesian3.ZERO, Cartesian3.UNIT_Z], Color.BLUE, width, modelMatrix);

  const primitives = new PrimitiveCollection();
  primitives.add(xPrimitive);
  primitives.add(yPrimitive);
  primitives.add(zPrimitive);

  return primitives;
}

function createPolylinePrimitive(positions, color, width = 1, modelMatrix = Matrix4.IDENTITY) {
  const geometry = new PolylineGeometry({
    positions: positions,
    width: width,
    vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
    arcType: ArcType.NONE,
  });

  const geometryInstance = new GeometryInstance({
    geometry: geometry,
    modelMatrix: modelMatrix,
  });

  return new Primitive({
    geometryInstances: [ geometryInstance ],
    appearance: new PolylineMaterialAppearance({
      translucent: color.a < 1.0 ? true : false,
      material: Material.fromType('PolylineArrow', {
        color: color
      }),
      renderState: disableDepthTestDepthWriteRenderStateScratch
    }),
    asynchronous: false,
    interleave: true,
  });
}

DebugSunAndMoonDirectionPrimitive.prototype.update = function (frameState) {
  if (!disableDepthTestDepthWriteRenderStateScratch) {
    disableDepthTestDepthWriteRenderStateScratch = RenderState.fromCache({
      depthTest: {
        enabled: true,
        func: DepthFunction.ALWAYS,
      },
      depthMask: false,
    });
  }

  if (!this.show) {
    return;
  }

  const camera = frameState.camera;
  const context = frameState.context;

  if (!this.sunSpriteImage || !this.moonSpriteImage) {
    const width = 64;
    const height = 64;
    const sunSpriteTexture = new Texture({
      context: context,
      width: width,
      height: height,
    });
    const moonSpriteTexture = new Texture({
      context: context,
      width: width,
      height: height,
    });

    const sunFramebuffer = new Framebuffer({
      context: context,
      colorTextures: [ sunSpriteTexture ],
      destroyAttachments: false,
    });
    const moonFramebuffer = new Framebuffer({
      context: context,
      colorTextures: [ moonSpriteTexture ],
      destroyAttachments: false,
    });

    const renderState = RenderState.fromCache({
      viewport: new BoundingRectangle(0, 0, width, height),
    });

    const sunCommand = context.createViewportQuadCommand(`
      in vec2 v_textureCoordinates;
      float rectangle(vec2 uv, vec2 center, vec2 halfSize) {
        vec2 pos = uv - center;
        vec2 edgeDistance = abs(pos) - halfSize;
        float outsideDistance = length(max(vec2(0.0), edgeDistance));
        float insideDistance = min(max(edgeDistance.x, edgeDistance.y), 0.0);

        float d = step(outsideDistance + insideDistance, 0.01);
        return d;
      }

      vec2 rotate(vec2 pos, float angle) {
        float cosine = cos(angle);
        float sine = sin(angle);
        return vec2(
          cosine * pos.x + sine * pos.y,
          cosine * pos.y - sine * pos.x
        );
      }

      void main() {
        vec2 uv = v_textureCoordinates;
        uv.y = 1.0 - uv.y;

        float circle = distance(uv, vec2(0.5));
        circle = step(circle, 0.3);
        float d = circle;

        const float PI = 3.1415926;
        d += rectangle(rotate(uv - 0.5, -0.0 / 180.0 * PI), vec2(0., 0.4), vec2(0.005, 0.05));
        d += rectangle(rotate(uv - 0.5, -30.0 / 180.0 * PI), vec2(0., 0.4), vec2(0.005, 0.05));
        d += rectangle(rotate(uv - 0.5, -60.0 / 180.0 * PI), vec2(0., 0.4), vec2(0.005, 0.05));
        d += rectangle(rotate(uv - 0.5, -90.0 / 180.0 * PI), vec2(0., 0.4), vec2(0.005, 0.05));
        d += rectangle(rotate(uv - 0.5, -120.0 / 180.0 * PI), vec2(0., 0.4), vec2(0.005, 0.05));
        d += rectangle(rotate(uv - 0.5, -150.0 / 180.0 * PI), vec2(0., 0.4), vec2(0.005, 0.05));
        d += rectangle(rotate(uv - 0.5, -180.0 / 180.0 * PI), vec2(0., 0.4), vec2(0.005, 0.05));
        d += rectangle(rotate(uv - 0.5, -210.0 / 180.0 * PI), vec2(0., 0.4), vec2(0.005, 0.05));
        d += rectangle(rotate(uv - 0.5, -240.0 / 180.0 * PI), vec2(0., 0.4), vec2(0.005, 0.05));
        d += rectangle(rotate(uv - 0.5, -270.0 / 180.0 * PI), vec2(0., 0.4), vec2(0.005, 0.05));
        d += rectangle(rotate(uv - 0.5, -300.0 / 180.0 * PI), vec2(0., 0.4), vec2(0.005, 0.05));
        d += rectangle(rotate(uv - 0.5, -330.0 / 180.0 * PI), vec2(0., 0.4), vec2(0.005, 0.05));

        out_FragColor = vec4(d);
      }
    `, {
      framebuffer: sunFramebuffer,
      renderState,
    });

    const moonCommand = context.createViewportQuadCommand(`
      in vec2 v_textureCoordinates;
      void main() {
        vec2 uv = v_textureCoordinates;
        uv.y = 1.0 - uv.y;

        float circle1 = distance(uv, vec2(0.5));
        circle1 = step(circle1, 0.4);

        float circle2 = distance(uv, vec2(0.7));
        circle2 = step(circle2, 0.4);

        float d = clamp(circle1 - circle2, 0.0, 1.0);

        out_FragColor = vec4(d);
      }
    `, {
      framebuffer: moonFramebuffer,
      renderState,
    });

    context.draw(sunCommand);
    context.draw(moonCommand);

    const sunTextureData = context.readPixels({
      width: width,
      height: height,
      framebuffer: sunFramebuffer,
    });
    sunFramebuffer.destroy();
    sunSpriteTexture.destroy();

    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = width;
    sunCanvas.height = height;
    const sunCtx = sunCanvas.getContext('2d');
    sunCtx.putImageData(new ImageData(new Uint8ClampedArray(sunTextureData), width, height), 0, 0);

    const moonTextureData = context.readPixels({
      width: width,
      height: height,
      framebuffer: moonFramebuffer,
    });
    moonFramebuffer.destroy();
    moonSpriteTexture.destroy();

    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = width;
    moonCanvas.height = height;
    const moonCtx = moonCanvas.getContext('2d');
    moonCtx.putImageData(new ImageData(new Uint8ClampedArray(moonTextureData), width, height), 0, 0);

    this.sunSpriteImage = sunCanvas;
    this.moonSpriteImage = moonCanvas;

    this.billboards.add({
      position: new Cartesian3(1, 1, 1),
      image: this.sunSpriteImage,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    this.billboards.add({
      position: new Cartesian3(1, 1, 1),
      image: this.moonSpriteImage,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
  }

  const groundPosition = Cartesian3.fromRadians(
    camera.positionCartographic.longitude,
    camera.positionCartographic.latitude,
    0
  );
  const ENU = Transforms.eastNorthUpToFixedFrame(groundPosition);
  const inverseENU = Matrix4.inverse(ENU, new Matrix4());
  const rotation = Matrix4.getRotation(ENU, new Matrix3());

  const sunDirectionWC = context.uniformState.sunDirectionWC;
  const moonDirectionWC = Matrix4.multiplyByPointAsVector(camera.inverseViewMatrix, context.uniformState.moonDirectionEC, new Cartesian3());
  const sunDirectionLocal = Matrix4.multiplyByPointAsVector(
    inverseENU,
    sunDirectionWC,
    new Cartesian3()
  );
  Cartesian3.normalize(sunDirectionLocal, sunDirectionLocal);
  const moonDirectionLocal = Matrix4.multiplyByPointAsVector(
    inverseENU,
    moonDirectionWC,
    new Cartesian3()
  );
  Cartesian3.normalize(moonDirectionLocal, moonDirectionLocal);


  // expose this?
  const near = camera.frustum.near + 10;
  const halfHorizontalOffset = Math.tan(camera.frustum.fov * 0.5) * near;
  const halfVerticalOffset = Math.tan(camera.frustum.fovy * 0.5) * near;
  const quarteHorizontaloffset = halfHorizontalOffset * 0.25;

  const pos = camera.positionWC.clone();
  Cartesian3.add(
    pos,
    Cartesian3.multiplyByScalar(camera.directionWC, near, new Cartesian3()),
    pos
  );
  Cartesian3.add(
    pos,
    Cartesian3.multiplyByScalar(camera.rightWC, halfHorizontalOffset * 0.5, new Cartesian3()),
    pos
  );
  Cartesian3.add(
    pos,
    Cartesian3.multiplyByScalar(camera.upWC, halfVerticalOffset * -0.25, new Cartesian3()),
    pos
  );

  const gizmoModelMatrix = Matrix4.fromRotationTranslation(rotation, pos);
  Matrix4.multiplyByUniformScale(
    gizmoModelMatrix,
    quarteHorizontaloffset,
    gizmoModelMatrix
  );

  const steps = 128;
  const circlePositions = [];
  const halfCirclePositions = [];
  for (let i = 0; i <= steps; i++) {
    const radians = i / steps * (Math.PI * 2);
    const x = Math.cos(radians);
    const y = Math.sin(radians);
    const z = 0;
    circlePositions.push(new Cartesian3(x, y, z));

    halfCirclePositions.push(new Cartesian3(
      Math.cos(radians * 0.5),
      0,
      Math.sin(radians * 0.5)
    ));
  }
  const circleColors = circlePositions.map(() => Color.WHITE);
  const halfCircleColors = halfCirclePositions.map(() => Color.WHITE);

  const circleGeometry = new PolylineGeometry({
    positions: circlePositions,
    width: 1,
    vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
    colors: circleColors,
    colorsPerVertex: true,
    arcType: ArcType.NONE,
  });
  const halfCircleGeometry = new PolylineGeometry({
    positions: halfCirclePositions,
    width: 1,
    vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
    colors: halfCircleColors,
    arcType: ArcType.NONE,
  });
  const outerCircleInstance = new GeometryInstance({
    geometry : circleGeometry,
    modelMatrix: gizmoModelMatrix,
  });
  const innerCircleInstance1 = new GeometryInstance({
    geometry : circleGeometry,
    modelMatrix: Matrix4.multiplyByUniformScale(gizmoModelMatrix, 0.75, new Matrix4()),
  });
  const innerCircleInstance2 = new GeometryInstance({
    geometry : circleGeometry,
    modelMatrix: Matrix4.multiplyByUniformScale(gizmoModelMatrix, 0.5, new Matrix4()),
  });
  const innerCircleInstance3 = new GeometryInstance({
    geometry : circleGeometry,
    modelMatrix: Matrix4.multiplyByUniformScale(gizmoModelMatrix, 0.25, new Matrix4()),
  });
  const halfCircleInstanceEastWest = new GeometryInstance({
    geometry : halfCircleGeometry,
    modelMatrix: gizmoModelMatrix,
  });
  const halfCircleInstanceNorthSouth = new GeometryInstance({
    geometry : halfCircleGeometry,
    modelMatrix: Matrix4.multiplyTransformation(
      gizmoModelMatrix,
      Matrix4.fromRotation(Matrix3.fromRotationZ(CesiumMath.toRadians(90))),
      new Matrix4()
    ),
  });
  const circlePrimitive = new Primitive({
    geometryInstances : [ outerCircleInstance, innerCircleInstance1, innerCircleInstance2, innerCircleInstance3, halfCircleInstanceEastWest, halfCircleInstanceNorthSouth ],
    appearance : new PolylineColorAppearance({
      translucent: false,
      renderState: disableDepthTestDepthWriteRenderStateScratch,
    }),
    asynchronous: false,
    interleave: true,
  });

  const xyzAxes = createModelMatrixPrimitive(gizmoModelMatrix);

  const polylines = new PolylineCollection();

  // sun direction
  const sunArrowStartPos = Cartesian3.add(
    pos,
    Cartesian3.multiplyByScalar(
      // sunDirectionWC,
      Matrix4.multiplyByPointAsVector(
        ENU,
        sunDirectionLocal,
        new Cartesian3()
      ),
      quarteHorizontaloffset + 0.5,
      new Cartesian3()
    ),
    new Cartesian3()
  );
  polylines.add({
    positions: [
      sunArrowStartPos,
      Cartesian3.add(
        pos,
        Cartesian3.multiplyByScalar(
          Matrix4.multiplyByPointAsVector(
            ENU,
            sunDirectionLocal,
            new Cartesian3()
          ),
          0.2,
          new Cartesian3()
        ),
        new Cartesian3()
      ),
    ],
    width: 20,
    material: Material.fromType('PolylineArrow', {
      color: sunDirectionLocal.z < 0 ?  Color.GRAY : Color.WHITE
    }),
  });

  // moon direction
  const moonArrowStartPos = Cartesian3.add(
    pos,
    Cartesian3.multiplyByScalar(
      // moonDirectionWC,
      Matrix4.multiplyByPointAsVector(
        ENU,
        moonDirectionLocal,
        new Cartesian3()
      ),
      quarteHorizontaloffset + 0.5,
      new Cartesian3()
    ),
    new Cartesian3()
  );
  polylines.add({
    positions: [
      moonArrowStartPos,
      Cartesian3.add(
        pos,
        Cartesian3.multiplyByScalar(
          Matrix4.multiplyByPointAsVector(
            ENU,
            moonDirectionLocal,
            new Cartesian3()
          ),
          0.2,
          new Cartesian3()
        ),
        new Cartesian3()
      ),
    ],
    width: 20,
    material: Material.fromType('PolylineArrow', {
      color: moonDirectionLocal.z < 0 ?  Color.GRAY : Color.WHITE
    }),
  });

  // project to xy plane
  polylines.add({
    positions: [
      pos,
      Cartesian3.add(
        pos,
        Matrix4.multiplyByPointAsVector(
          ENU,
          new Cartesian3(sunDirectionLocal.x * quarteHorizontaloffset, sunDirectionLocal.y * quarteHorizontaloffset, 0.0),
          new Cartesian3()
        ),
        new Cartesian3()
      )
    ],
    width: 1,
    material: Material.fromType('Color', {
      color: Color.YELLOW
    }),
  });

  // y
  polylines.add({
    positions: [
      Cartesian3.add(
        pos,
        Matrix4.multiplyByPointAsVector(
          ENU,
          new Cartesian3(sunDirectionLocal.x * quarteHorizontaloffset, 0.0, 0.0),
          new Cartesian3()
        ),
        new Cartesian3()
      ),
      Cartesian3.add(
        pos,
        Matrix4.multiplyByPointAsVector(
          ENU,
          new Cartesian3(sunDirectionLocal.x * quarteHorizontaloffset, sunDirectionLocal.y * quarteHorizontaloffset, 0.0),
          new Cartesian3()
        ),
        new Cartesian3()
      ),
    ],
    width: 1,
    material: Material.fromType('Color', {
      color: Color.DARKGREEN
    }),
  });

  // x
  polylines.add({
    positions: [
      Cartesian3.add(
        pos,
        Matrix4.multiplyByPointAsVector(
          ENU,
          new Cartesian3(0.0, sunDirectionLocal.y * quarteHorizontaloffset, 0.0),
          new Cartesian3()
        ),
        new Cartesian3()
      ),
      Cartesian3.add(
        pos,
        Matrix4.multiplyByPointAsVector(
          ENU,
          new Cartesian3(sunDirectionLocal.x * quarteHorizontaloffset, sunDirectionLocal.y * quarteHorizontaloffset, 0.0),
          new Cartesian3()
        ),
        new Cartesian3()
      ),
    ],
    width: 1,
    material: Material.fromType('Color', {
      color: Color.DARKRED
    }),
  });

  // z
  polylines.add({
    positions: [
      Cartesian3.add(
        pos,
        Matrix4.multiplyByPointAsVector(
          ENU,
          new Cartesian3(sunDirectionLocal.x * quarteHorizontaloffset, sunDirectionLocal.y * quarteHorizontaloffset, 0.0),
          new Cartesian3()
        ),
        new Cartesian3()
      ),
      Cartesian3.add(
        pos,
        Cartesian3.multiplyByScalar(
          sunDirectionWC,
          quarteHorizontaloffset,
          new Cartesian3()
        ),
        new Cartesian3()
      ),
    ],
    width: 1,
    material: Material.fromType('Color', {
      color: Color.DARKBLUE,
    })
  });

  this.labelCollection.get(0).position = Cartesian3.add(
    pos,
    Matrix4.multiplyByPointAsVector(
      ENU,
      new Cartesian3(quarteHorizontaloffset, 0.0, 0.0),
      new Cartesian3()
    ),
    new Cartesian3()
  );
  this.labelCollection.get(1).position = Cartesian3.add(
    pos,
    Matrix4.multiplyByPointAsVector(
      ENU,
      new Cartesian3(0.0, quarteHorizontaloffset, 0.0),
      new Cartesian3()
    ),
    new Cartesian3()
  );
  this.labelCollection.get(2).position = Cartesian3.add(
    pos,
    Matrix4.multiplyByPointAsVector(
      ENU,
      new Cartesian3(0.0, 0.0, quarteHorizontaloffset),
      new Cartesian3()
    ),
    new Cartesian3()
  );

  const primitives = this.primitives;
  primitives.add(circlePrimitive);
  primitives.add(xyzAxes)
  primitives.add(polylines);

  primitives.update(frameState);
  this.labelCollection.update(frameState);

  this.billboards.get(0).position = sunArrowStartPos;
  this.billboards.get(0).color = sunDirectionLocal.z < 0 ?  Color.GRAY : Color.YELLOW;
  this.billboards.get(1).position = moonArrowStartPos;
  this.billboards.get(1).color = moonDirectionLocal.z < 0 ?  Color.GRAY : Color.WHITE;
  this.billboards.update(frameState);

  // destroy primitives
  frameState.afterRender.push(() => primitives.removeAll());
};

DebugSunAndMoonDirectionPrimitive.prototype.isDestroyed = function () {
  return false;
};

DebugSunAndMoonDirectionPrimitive.prototype.destroy = function () {
  this.sunSpriteImage = undefined;
  this.moonSpriteImage = undefined;

  this.primitives = this.primitives && this.primitives.destroy();
  this.labelCollection = this.labelCollection && this.labelCollection.destroy();
  return destroyObject(this);
};

export default DebugSunAndMoonDirectionPrimitive;
